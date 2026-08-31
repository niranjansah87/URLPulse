import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { URL_CHECK_QUEUE, type UrlCheckJobData } from "@urlpulse/types";

/**
 * Producer-side handle to the URL-check queue. The API enqueues one job per URL
 * (see docs/03-backend/api.md §22); the worker consumes them. Not yet wired
 * into batch creation — that is the next implementation phase.
 */
export function createUrlCheckQueue(connection: Redis): Queue<UrlCheckJobData> {
  return new Queue<UrlCheckJobData>(URL_CHECK_QUEUE, { connection });
}
