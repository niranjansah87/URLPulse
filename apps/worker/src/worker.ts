import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import {
  BATCH_EVENTS_CHANNEL,
  buildBatchUpdatedMessage,
  URL_CHECK_QUEUE,
  type UrlCheckJobData,
} from "@urlpulse/types";
import { config } from "./lib/env";
import { createRedis, createCommandRedis } from "./lib/redis";
import { createDb } from "./lib/db";
import { checkUrl } from "./lib/http-checker";
import { createRateLimiter, type RedisEval } from "@urlpulse/outbound";
import { createConcurrencyLimiter, type RedisSemaphoreClient } from "./lib/concurrency";
import { createUrlRepository } from "./repositories/urls";
import { createUrlCheckProcessor } from "./jobs/url-check";

/**
 * Worker process bootstrap. Consumes the url-check queue and performs real HTTP
 * health checks against PostgreSQL-authoritative state.
 *
 * NOTE: BullMQ's `concurrency` below is this process's local prefetch, NOT the
 * system's global 5-in-flight guarantee. Global rate/concurrency are
 * Redis-coordinated and enforced inside the processor in Phases 4/5
 * (ADR-006/007/022).
 */
export function startWorker(): Worker<UrlCheckJobData> {
  const connection = createRedis();
  const commandRedis = createCommandRedis();
  const db = createDb();

  const rateLimiter = createRateLimiter(commandRedis as unknown as RedisEval, {
    limit: config.RATE_LIMIT_RPS,
    windowMs: 1000,
    key: "rl:outbound",
  });
  const concurrency = createConcurrencyLimiter(commandRedis as unknown as RedisSemaphoreClient, {
    limit: config.MAX_CONCURRENCY,
    leaseTtlMs: config.CONCURRENCY_LEASE_TTL_MS,
    key: "sem:outbound",
  });

  // Human-readable lines in dev; structured JSON in production for aggregators.
  const pretty = config.NODE_ENV !== "production";
  const format = (level: "info" | "warn", obj: object, msg?: string): string => {
    if (!pretty) return JSON.stringify({ level, msg, ...obj });
    const time = new Date().toLocaleTimeString("en-GB");
    const fields = Object.entries(obj)
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" ");
    return `${time} ${level.toUpperCase().padEnd(4)} ${msg ?? ""}${fields ? `  ${fields}` : ""}`;
  };
  const log = {
    info: (obj: object, msg?: string) => console.log(format("info", obj, msg)),
    warn: (obj: object, msg?: string) => console.warn(format("warn", obj, msg)),
  };

  const processor = createUrlCheckProcessor({
    repo: createUrlRepository(db, {
      slowThresholdMs: config.ALERT_SLOW_RESPONSE_MS,
      sslWarnDays: config.ALERT_SSL_WARN_DAYS,
    }),
    checkUrl,
    checkOptions: {
      timeoutMs: config.HTTP_TIMEOUT_MS,
      maxRedirects: config.HTTP_MAX_REDIRECTS,
      maxBodyBytes: config.HTTP_MAX_BODY_BYTES,
      allowPrivateHosts: config.HTTP_ALLOW_PRIVATE_HOSTS,
    },
    concurrency,
    rateLimiter,
    publish: (batchId) =>
      commandRedis.publish(BATCH_EVENTS_CHANNEL, buildBatchUpdatedMessage(batchId)).then(() => undefined),
    maxAttempts: config.MAX_RETRIES + 1,
    log,
  });

  const worker = new Worker<UrlCheckJobData>(URL_CHECK_QUEUE, processor, {
    connection,
    concurrency: config.MAX_CONCURRENCY,
  });

  worker.on("ready", () => console.log(`[worker] connected, consuming "${URL_CHECK_QUEUE}"`));
  worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id ?? "?"} failed:`, err));

  const shutdown = () => {
    worker
      .close()
      .then(() => Promise.allSettled([connection.quit(), commandRedis.quit()]))
      .then(() => db.end({ timeout: 5 }))
      .then(
        () => process.exit(0),
        () => process.exit(1),
      );
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return worker;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  startWorker();
}
