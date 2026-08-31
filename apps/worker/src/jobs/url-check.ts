import type { Job } from "bullmq";
import { urlCheckJobDataSchema, type UrlCheckJobData } from "@urlpulse/types";
import type { UrlRepository } from "../repositories/urls";
import type { CheckOptions, UrlCheckResult } from "../lib/http-checker";

export interface ProcessorLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
}

export interface ProcessorDeps {
  repo: UrlRepository;
  checkUrl: (url: string, opts: CheckOptions) => Promise<UrlCheckResult>;
  checkOptions: CheckOptions;
  log: ProcessorLogger;
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
  const { repo, checkUrl, checkOptions, log } = deps;

  return async function urlCheckProcessor(job: Job<UrlCheckJobData>): Promise<void> {
    const { batchId, urlId } = urlCheckJobDataSchema.parse(job.data);

    const claimed = await repo.claim(urlId);
    if (!claimed) {
      // Not PENDING: another worker owns it, it is terminal, or it was cancelled.
      // NOTE (Phase 6): a crash between claim and persist leaves a URL stuck in
      // PROCESSING; recovering those (lease expiry / PROCESSING→PENDING reclaim)
      // is the crash-hardening phase and is intentionally not handled here yet.
      log.info({ jobId: job.id, batchId, urlId }, "url not claimable; skipping");
      return;
    }

    // PHASE 4/5 SEAM: acquire the global rate-limit permit and the distributed
    // concurrency lease here, immediately before the outbound request
    // (rate-limiting.md §8), releasing the lease in a finally.
    const result = await checkUrl(claimed.url, checkOptions);

    const outcome = await repo.persistResult(urlId, result);
    log.info(
      { jobId: job.id, batchId, urlId, status: result.status, httpStatus: result.httpStatus, outcome },
      "url check complete",
    );
  };
}
