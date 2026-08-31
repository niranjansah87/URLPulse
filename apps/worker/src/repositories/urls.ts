import type { Db } from "../lib/db";
import type { UrlCheckResult } from "../lib/http-checker";

/**
 * Worker-side data access for URL processing. The API and worker are separate
 * deployables (ADR-015); each owns the SQL for the operations it performs. The
 * worker owns the claim, the result write, and the batch-completion transition.
 *
 * All transitions are conditional (`WHERE status = <expected>`) so duplicate job
 * delivery, stale jobs, and cancellation races cannot corrupt state or
 * double-count counters (ADR-008/009, INV-7).
 */
export interface UrlRepository {
  claim(urlId: string): Promise<{ url: string } | null>;
  persistResult(urlId: string, result: UrlCheckResult): Promise<"applied" | "skipped">;
  releaseForRetry(urlId: string): Promise<"applied" | "skipped">;
}

export function createUrlRepository(db: Db): UrlRepository {
  return {
    /**
     * Atomically move a URL PENDING → PROCESSING (incrementing attempt_count)
     * and lift its batch PENDING → PROCESSING. Returns the URL string if this
     * caller won the claim, or null if the row was not PENDING (already claimed,
     * terminal, or cancelled) — in which case the worker must not do the work.
     * Commits before any HTTP request (never hold a tx across external I/O).
     */
    async claim(urlId) {
      return db.begin(async (tx) => {
        const [row] = await tx<{ url: string; batch_id: string }[]>`
          UPDATE urls
          SET status = 'PROCESSING', started_at = now(), attempt_count = attempt_count + 1, updated_at = now()
          WHERE id = ${urlId} AND status = 'PENDING'
          RETURNING url, batch_id
        `;
        if (!row) return null;
        await tx`
          UPDATE batches
          SET status = 'PROCESSING', started_at = COALESCE(started_at, now()), updated_at = now()
          WHERE id = ${row.batch_id} AND status = 'PENDING'
        `;
        return { url: row.url };
      });
    },

    /**
     * Persist a terminal result for a URL that is still PROCESSING, bump the
     * matching batch counter, and — if the batch is now fully accounted for —
     * transition it to its terminal state, all in one transaction. Returns
     * "skipped" when the URL is no longer PROCESSING (cancelled/duplicate/stale),
     * guaranteeing counters move at most once per logical completion.
     *
     * Batch terminal precedence (ADR-025): a CANCELLED batch is never PROCESSING,
     * so the completion UPDATE cannot touch it; among PROCESSING batches, any
     * failure yields FAILED, otherwise COMPLETED.
     */
    async persistResult(urlId, result) {
      return db.begin(async (tx) => {
        const [row] = await tx<{ batch_id: string }[]>`
          UPDATE urls
          SET status = ${result.status},
              http_status = ${result.httpStatus},
              response_time_ms = ${result.responseTimeMs},
              page_title = ${result.pageTitle},
              error_code = ${result.errorCode},
              error_message = ${result.errorMessage},
              completed_at = now(),
              updated_at = now()
          WHERE id = ${urlId} AND status = 'PROCESSING'
          RETURNING batch_id
        `;
        if (!row) return "skipped";

        if (result.status === "SUCCESS") {
          await tx`UPDATE batches SET completed_count = completed_count + 1, updated_at = now() WHERE id = ${row.batch_id}`;
        } else {
          await tx`UPDATE batches SET failed_count = failed_count + 1, updated_at = now() WHERE id = ${row.batch_id}`;
        }

        await tx`
          UPDATE batches
          SET status = CASE WHEN failed_count > 0 THEN 'FAILED' ELSE 'COMPLETED' END,
              completed_at = now(),
              updated_at = now()
          WHERE id = ${row.batch_id}
            AND status = 'PROCESSING'
            AND completed_count + failed_count + cancelled_count >= total_count
        `;
        return "applied";
      });
    },

    /**
     * Return a URL to PENDING so BullMQ's backoff redelivery can re-claim it for
     * another attempt (ADR-023). Conditional on the URL still being PROCESSING:
     * if cancellation or another transition won in the meantime this affects
     * zero rows and returns "skipped", so a cancelled URL is never resurrected
     * into a retry. attempt_count is left as-is (it was incremented at claim and
     * represents attempts already made).
     */
    async releaseForRetry(urlId) {
      const rows = await db`
        UPDATE urls
        SET status = 'PENDING', started_at = NULL, updated_at = now()
        WHERE id = ${urlId} AND status = 'PROCESSING'
      `;
      return rows.count > 0 ? "applied" : "skipped";
    },
  };
}
