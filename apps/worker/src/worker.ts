import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import { URL_CHECK_QUEUE, type UrlCheckJobData } from "@urlpulse/types";
import { config } from "./lib/env";
import { createRedis } from "./lib/redis";
import { createDb } from "./lib/db";
import { checkUrl } from "./lib/http-checker";
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
  const db = createDb();

  const log = {
    info: (obj: object, msg?: string) => console.log(JSON.stringify({ level: "info", msg, ...obj })),
    warn: (obj: object, msg?: string) => console.warn(JSON.stringify({ level: "warn", msg, ...obj })),
  };

  const processor = createUrlCheckProcessor({
    repo: createUrlRepository(db),
    checkUrl,
    checkOptions: {
      timeoutMs: config.HTTP_TIMEOUT_MS,
      maxRedirects: config.HTTP_MAX_REDIRECTS,
      maxBodyBytes: config.HTTP_MAX_BODY_BYTES,
    },
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
      .then(() => connection.quit())
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
