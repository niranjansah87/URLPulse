import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { URL_CHECK_QUEUE, type UrlCheckJobData } from "@urlpulse/types";
import { config } from "./env";

export type UrlCheckQueue = Queue<UrlCheckJobData>;

/** Job name within the url-check queue. */
const URL_CHECK_JOB = "check" as const;

/**
 * Producer-side handle to the URL-check queue. One job is created per URL
 * (docs/03-backend/api.md §22). Retry/backoff live in `defaultJobOptions` so the
 * worker inherits the documented policy without duplicating it: up to
 * MAX_RETRIES retries after the initial attempt = MAX_RETRIES + 1 total attempts
 * (INV-5), exponential backoff (retries-and-idempotency.md §5).
 */
export function createUrlCheckQueue(connection: Redis): UrlCheckQueue {
  return new Queue<UrlCheckJobData>(URL_CHECK_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: config.MAX_RETRIES + 1,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}

/**
 * Enqueue one URL-check job. The BullMQ job id is the URL id, which makes
 * enqueueing idempotent: a duplicate add (e.g. from the reconciliation sweep,
 * ADR-028) for a URL whose job still exists is ignored rather than creating a
 * second logical job. Full duplicate-execution safety is the worker's job in a
 * later milestone; this only guarantees stable job identity.
 */
export async function enqueueUrlCheck(queue: UrlCheckQueue, data: UrlCheckJobData): Promise<void> {
  await queue.add(URL_CHECK_JOB, data, { jobId: data.urlId });
}
