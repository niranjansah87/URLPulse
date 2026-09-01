import type { Job } from "bullmq";
import { urlCheckJobDataSchema, type UrlCheckJobData } from "@urlpulse/types";
import type { UrlRepository } from "../repositories/urls";
import type { CheckOptions, UrlCheckResult } from "../lib/http-checker";

export interface ProcessorLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
}

export interface RateLimiterPort {
  acquire(): Promise<void>;
}

export interface ConcurrencyPort {
  acquire(): Promise<{ release(): Promise<void> }>;
}

export interface ProcessorDeps {
  repo: UrlRepository;
  checkUrl: (
    url: string,
    opts: CheckOptions,
    onRequest?: () => Promise<void>,
  ) => Promise<UrlCheckResult>;
  checkOptions: CheckOptions;
  /** Global distributed concurrency limiter (INV-3). Acquired before the permit. */
  concurrency: ConcurrencyPort;
  /** Global outbound rate limiter (INV-4). Acquired before every request. */
  rateLimiter: RateLimiterPort;
  /** Publish a batch.updated notification after a committed state change. */
  publish: (batchId: string) => Promise<void>;
  /**
   * Invalidate the batch-list cache after a batch-level state change (ADR-012):
   * PENDING → PROCESSING when work starts, and → terminal when it finishes. Only
   * batch-level transitions call this (never per-URL), so the cache is not
   * defeated. Best-effort - a failure never fails the job. Injected so the worker
   * bumps the shared Redis version key without importing the API's cache module.
   */
  invalidateListCache: () => Promise<void>;
  /** Max attempts per round (initial + retries), = MAX_RETRIES + 1 (INV-5). */
  maxAttempts: number;
  log: ProcessorLogger;
}

/** Thrown to hand a URL back to BullMQ for a backoff retry (ADR-023). */
export class RetryableCheckError extends Error {
  constructor(code: string) {
    super(`retryable check failure: ${code}`);
    this.name = "RetryableCheckError";
  }
}

/**
 * Build the url-check job processor.
 *
 * Order (job-lifecycle.md §13): load/validate payload → conditionally claim the
 * URL (PostgreSQL is authoritative; the payload is not trusted) → [rate-limit &
 * concurrency admission are added here in Phases 4/5] → HTTP check → persist the
 * result transactionally. The claim commits before the HTTP request so no DB
 * transaction is held across external I/O.
 *
 * Idempotency: only the caller that wins the conditional PENDING→PROCESSING
 * claim performs the check; a duplicate/stale delivery finds the row already
 * claimed or terminal and returns without doing work or double-counting.
 */
export function createUrlCheckProcessor(deps: ProcessorDeps) {
  const { repo, checkUrl, checkOptions, concurrency, rateLimiter, publish, invalidateListCache, maxAttempts, log } =
    deps;

  const invalidateCache = (): Promise<void> =>
    invalidateListCache().catch((err) =>
      log.warn({ err: (err as Error).message }, "batch-list cache invalidation failed"),
    );

  return async function urlCheckProcessor(job: Job<UrlCheckJobData>): Promise<void> {
    const { batchId, urlId } = urlCheckJobDataSchema.parse(job.data);

    const claimed = await repo.claim(urlId);
    if (!claimed) {
      // Not PENDING: another worker owns it, it is terminal, or it was cancelled.
      log.info({ jobId: job.id, batchId, urlId }, "url not claimable; skipping");
      return;
    }
    // This claim just lifted the batch PENDING → PROCESSING: a batch-level state
    // change, so the cached batch list must not keep showing it as PENDING.
    if (claimed.batchActivated) await invalidateCache();

    try {
      // Global admission for the whole check: one distributed concurrency slot
      // held across all hops (a URL check = one in-flight slot regardless of
      // redirects). The rate permit is acquired PER outbound request via the
      // onRequest hook, so each redirect hop is counted against the global 10
      // req/s limit (rate-limiting.md §8). The slot is always released in the
      // finally; a crashed worker's slot is reclaimed by lease expiry (ADR-022).
      const slot = await concurrency.acquire();
      try {
        const result = await checkUrl(claimed.url, checkOptions, () => rateLimiter.acquire());

        // attemptsMade is the number of attempts already completed (0 on the
        // first run). Retry a transient failure only while attempts remain.
        const attemptsRemain = job.attemptsMade < maxAttempts - 1;
        if (result.status === "FAILED" && result.retryable && attemptsRemain) {
          const released = await repo.releaseForRetry(urlId);
          if (released === "applied") {
            log.warn(
              { jobId: job.id, batchId, urlId, errorCode: result.errorCode, attempt: job.attemptsMade + 1 },
              "transient failure; scheduling retry",
            );
            throw new RetryableCheckError(result.errorCode ?? "UNKNOWN");
          }
          // Release skipped: cancellation/another transition won - do not retry.
          log.info({ jobId: job.id, batchId, urlId }, "retry aborted; url no longer processing");
          return;
        }

        const { outcome, batchFinalized } = await repo.persistResult(urlId, result);
        log.info(
          { jobId: job.id, batchId, urlId, status: result.status, httpStatus: result.httpStatus, outcome },
          "url check complete",
        );
        // Publish AFTER the DB commit (live-updates.md §7). Best-effort: a failed
        // notification never fails the job - clients reconcile from PostgreSQL.
        if (outcome === "applied") {
          await publish(batchId).catch((err) =>
            log.warn({ batchId, urlId, err: (err as Error).message }, "batch.updated publish failed"),
          );
          // The batch just reached a terminal state: invalidate the list cache so
          // COMPLETED/FAILED shows immediately, not after the 30s TTL (ADR-012).
          if (batchFinalized) await invalidateCache();
        }
      } finally {
        await slot.release().catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof RetryableCheckError) throw err; // URL already released
      // Unexpected/infra failure (e.g. Redis down during admission) after the
      // claim: return the URL to PENDING so a BullMQ retry can re-claim it,
      // rather than leaving it stuck in PROCESSING. Then rethrow so BullMQ retries.
      await repo.releaseForRetry(urlId).catch(() => undefined);
      throw err;
    }
  };
}
