import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { BATCH_EVENTS_CHANNEL, buildBatchUpdatedMessage, type ApiError } from "@urlpulse/types";
import { config } from "./lib/env";
import { createDb } from "./lib/db";
import { createRedis, createSubscriberRedis } from "./lib/redis";
import { createUrlCheckQueue, enqueueUrlCheck, type UrlCheckQueue } from "./lib/queue";
import { createEventBus, type EventBus } from "./lib/events";
import { createBatchListCache, type CacheRedis } from "./lib/cache";
import { ApiDomainError } from "./lib/errors";
import { auth, authPool } from "./lib/auth";
import { apiConfig } from "./lib/env";
import { createRequireAuth, type RequireAuth } from "./lib/require-auth";
import { createCsrfGuard } from "./lib/csrf";
import { registerAuthRoutes } from "./routes/auth";
import { createBatchRepository } from "./repositories/batches";
import { createBatchService, type BatchService } from "./services/batches";
import { createAlertRepository } from "./repositories/alerts";
import { createAlertService } from "./services/alerts";
import { registerHealthRoutes } from "./routes/health";
import { registerBatchRoutes } from "./routes/batches";
import { registerAlertRoutes } from "./routes/alerts";
import { registerDemoRoutes } from "./routes/demo";
import type { Redis } from "ioredis";

export interface ServerOverrides {
  /** Inject a pre-built service to avoid creating a real queue (used in tests). */
  service?: BatchService;
  /** Inject an event bus to avoid opening a Redis subscriber (used in tests). */
  eventBus?: EventBus;
  /**
   * Inject the auth boundary to avoid mounting Better Auth / opening its pool
   * (used in tests). When provided, the Better Auth handler is NOT mounted.
   */
  requireAuth?: RequireAuth;
}

export function buildServer(overrides: ServerOverrides = {}) {
  const app = Fastify({
    // Bound the JSON body so a malicious/oversized request cannot exhaust memory
    // (multipart CSV has its own 5MB limit below). Comfortably fits a max batch.
    bodyLimit: 4 * 1024 * 1024,
    // Derive req.ip from X-Forwarded-For only when explicitly behind a trusted
    // proxy; otherwise clients could spoof it and evade the demo per-IP limit.
    trustProxy: config.TRUST_PROXY,
    logger: {
      // Never log credentials even if a future change starts logging headers.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
      // Human-readable, colorized lines in dev; raw JSON in production so log
      // aggregators can parse it. pino-pretty is a dev-only dependency.
      transport:
        config.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname", singleLine: true },
            },
    },
    // Correlate logs across a request: honor an inbound X-Request-Id (e.g. from
    // a gateway) or generate one. Fastify stamps every log line with reqId.
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      return (typeof header === "string" && header.length > 0 && header) || randomUUID();
    },
  });
  const db = createDb();
  const redis = createRedis();

  // Only stand up the BullMQ producer when we need the default service; an
  // injected service (tests) must not force a Redis connection.
  let queue: UrlCheckQueue | undefined;
  let service: BatchService;
  if (overrides.service) {
    service = overrides.service;
  } else {
    const q = createUrlCheckQueue(redis);
    queue = q;
    service = createBatchService({
      repo: createBatchRepository(db),
      enqueue: (data) => enqueueUrlCheck(q, data),
      publish: (batchId) => redis.publish(BATCH_EVENTS_CHANNEL, buildBatchUpdatedMessage(batchId)).then(() => undefined),
      cache: createBatchListCache(redis as unknown as CacheRedis, config.BATCH_LIST_CACHE_SECONDS),
      stuckProcessingMs: config.STUCK_PROCESSING_MS,
      log: app.log,
    });

    // Periodic reconciliation sweep (ADR-028): only on the real service path, so
    // tests do not start timers. Idempotent across instances.
    const timer = setInterval(() => {
      void service.reconcile().catch((err) => app.log.error(err, "reconciliation failed"));
    }, config.RECONCILE_INTERVAL_MS);
    timer.unref?.();
    app.addHook("onClose", async () => clearInterval(timer));
  }

  // The event bus fans out cross-instance batch.updated notifications to local
  // SSE clients. An injected bus (tests) skips opening a Redis subscriber.
  let subscriber: Redis | undefined;
  let eventBus: EventBus;
  if (overrides.eventBus) {
    eventBus = overrides.eventBus;
  } else {
    subscriber = createSubscriberRedis();
    eventBus = createEventBus(subscriber);
    void eventBus.start().catch((err) => app.log.error(err, "event bus subscribe failed"));
  }

  // Credentialed CORS: the web app (a separate origin) sends the session cookie,
  // so credentials are allowed and the allowed origin is the configured web
  // origin only - never "*" and never a reflected arbitrary origin, in any
  // environment. Arbitrary-origin reflection + credentials would defeat CORS.
  app.register(cors, {
    origin: [apiConfig.WEB_ORIGIN],
    credentials: true,
  });
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  // Authentication boundary. Tests inject requireAuth and skip mounting the
  // Better Auth HTTP handler (and its DB pool). The real path mounts /api/auth/*
  // and resolves sessions from the shared Better Auth instance.
  let requireAuth: RequireAuth;
  if (overrides.requireAuth) {
    requireAuth = overrides.requireAuth;
  } else {
    requireAuth = createRequireAuth(auth.api);
    registerAuthRoutes(app, auth);
  }
  // NOTE: `authPool` is a process-wide singleton shared by every Better Auth
  // instance. It is deliberately NOT closed in this server's onClose - doing so
  // would kill auth for any other server built in the same process (e.g. tests,
  // or multiple instances). It is drained once at process shutdown (see isMain).

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ApiDomainError) {
      const body: ApiError = {
        error: { code: err.code, message: err.message, details: err.details },
      };
      reply.status(err.statusCode).send(body);
      return;
    }
    // Fastify's own validation / client errors keep their 4xx status; everything
    // else is an unexpected 500 with no internal detail leaked.
    const status = typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    const body: ApiError = {
      error: {
        code: status >= 500 ? "INTERNAL_ERROR" : (err.code ?? "VALIDATION_ERROR"),
        message: status >= 500 ? "Internal server error" : err.message,
      },
    };
    reply.status(status).send(body);
  });

  app.setNotFoundHandler((_req, reply) => {
    const body: ApiError = { error: { code: "NOT_FOUND", message: "Route not found" } };
    reply.status(404).send(body);
  });

  // The web origin is the single trusted browser origin: it gates CSRF, the SSE
  // CORS reflection, and @fastify/cors above.
  const allowedOrigins = [apiConfig.WEB_ORIGIN];
  const csrfGuard = createCsrfGuard(allowedOrigins);

  registerHealthRoutes(app, { db, redis });
  app.register(registerBatchRoutes, {
    prefix: "/api",
    service,
    eventBus,
    requireAuth,
    csrfGuard,
    allowedOrigins,
  });
  app.register(registerAlertRoutes, {
    prefix: "/api",
    service: createAlertService(createAlertRepository(db)),
    requireAuth,
    csrfGuard,
  });
  // Public demo (no auth, no persistence): landing-page "try it" checks.
  app.register(registerDemoRoutes, { prefix: "/api", redis });

  app.addHook("onClose", async () => {
    if (queue) await queue.close().catch(() => undefined);
    if (subscriber) await subscriber.quit().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    await db.end({ timeout: 5 }).catch(() => undefined);
  });

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const app = buildServer();
  const shutdown = () => {
    // Drain the server, then the process-wide auth pool, then exit.
    app
      .close()
      .then(() => authPool.end())
      .then(
        () => process.exit(0),
        () => process.exit(1),
      );
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  app.listen({ port: config.API_PORT, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
