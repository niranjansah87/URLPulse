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
 * Enqueue one URL-check job. The BullMQ job id is the URL id, giving each URL a
 * stable identity so concurrent enqueues converge on a single logical job.
 *
 * A URL can legitimately be re-enqueued after its previous job already finished:
 * retry-failed (ADR-024) and the reconciliation sweep (ADR-028) both re-add by
 * URL id. BullMQ de-duplicates by jobId AND retains finished jobs
 * (removeOnComplete/removeOnFail above), so a plain re-add for a still-retained
 * job id is a silent no-op - the URL would be reset to PENDING in PostgreSQL but
 * never actually reprocessed, wedging the batch in PROCESSING. So remove any
 * existing job under this id first. It is best-effort: a lock error means a job
 * is actively running under this id, in which case the add below correctly
 * de-dups and we must NOT create a second concurrent run.
 */
export async function enqueueUrlCheck(queue: UrlCheckQueue, data: UrlCheckJobData): Promise<void> {
  await queue.remove(data.urlId).catch(() => {});
  await queue.add(URL_CHECK_JOB, data, { jobId: data.urlId });
}
