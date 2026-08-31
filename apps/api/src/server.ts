import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { ApiError } from "@urlpulse/types";
import { config } from "./lib/env";
import { createDb } from "./lib/db";
import { createRedis } from "./lib/redis";
import { createUrlCheckQueue, enqueueUrlCheck, type UrlCheckQueue } from "./lib/queue";
import { ApiDomainError } from "./lib/errors";
import { createBatchRepository } from "./repositories/batches";
import { createBatchService, type BatchService } from "./services/batches";
import { registerHealthRoutes } from "./routes/health";
import { registerBatchRoutes } from "./routes/batches";

export interface ServerOverrides {
  /** Inject a pre-built service to avoid creating a real queue (used in tests). */
  service?: BatchService;
}

export function buildServer(overrides: ServerOverrides = {}) {
  const app = Fastify({
    logger: true,
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
      log: app.log,
    });
  }

  app.register(cors, { origin: true });
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

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

  registerHealthRoutes(app, { db, redis });
  app.register(registerBatchRoutes, { prefix: "/api", service });

  app.addHook("onClose", async () => {
    if (queue) await queue.close().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    await db.end({ timeout: 5 }).catch(() => undefined);
  });

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const app = buildServer();
  const shutdown = () => {
    app.close().then(
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
