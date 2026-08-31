import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import { URL_CHECK_QUEUE, type UrlCheckJobData } from "@urlpulse/types";
import { config } from "./lib/env";
import { createRedis } from "./lib/redis";
import { urlCheckProcessor } from "./jobs/url-check";

/**
 * Worker process bootstrap. Consumes the url-check queue.
 *
 * NOTE: `concurrency` below is BullMQ's local prefetch, NOT the system's global
 * 5-in-flight guarantee. The global rate limit and global concurrency are
 * Redis-coordinated and enforced inside the processor in a later phase
 * (ADR-006, ADR-007, ADR-022). Do not treat this local number as the global cap.
 */
export function startWorker(): Worker<UrlCheckJobData> {
  const connection = createRedis();
  const worker = new Worker<UrlCheckJobData>(URL_CHECK_QUEUE, urlCheckProcessor, {
    connection,
    concurrency: config.MAX_CONCURRENCY,
  });

  worker.on("ready", () => console.log(`[worker] connected, consuming "${URL_CHECK_QUEUE}"`));
  worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id ?? "?"} failed:`, err));

  const shutdown = () => {
    worker
      .close()
      .then(() => connection.quit())
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
