import type { Db } from "../lib/db";
import type { UrlCheckResult } from "../lib/http-checker";
import { deriveAlerts, FAILURE_ALERT_TYPES } from "../lib/alerts";

export interface AlertOptions {
  /** Response time (ms) above which a SUCCESS raises SLOW_RESPONSE. */
  slowThresholdMs: number;
  /** Raise SSL_EXPIRING when the cert expires within this many days. */
  sslWarnDays: number;
}

/**
 * Worker-side data access for URL processing. The API and worker are separate
 * deployables (ADR-015); each owns the SQL for the operations it performs. The
 * worker owns the claim, the result write, and the batch-completion transition.
 *
 * All transitions are conditional (`WHERE status = <expected>`) so duplicate job
 * delivery, stale jobs, and cancellation races cannot corrupt state or
 * double-count counters (ADR-008/009, INV-7).
 */
/** Outcome of persisting a URL result. `batchFinalized` is true only when THIS
 * write drove the batch into a terminal state, so the caller can invalidate the
 * batch-list cache exactly once per batch completion (not per URL). */
export interface PersistOutcome {
  outcome: "applied" | "skipped";
  batchFinalized: boolean;
}

export interface UrlRepository {
  /** `batchActivated` is true only when this claim lifted the batch PENDING →
   * PROCESSING, so the caller can invalidate the list cache on that transition. */
  claim(urlId: string): Promise<{ url: string; batchActivated: boolean } | null>;
  persistResult(urlId: string, result: UrlCheckResult): Promise<PersistOutcome>;
  releaseForRetry(urlId: string): Promise<"applied" | "skipped">;
  recoverStuck(olderThanMs: number): Promise<number>;
}

export function createUrlRepository(db: Db, alertOptions: AlertOptions): UrlRepository {
  return {
    /**
     * Atomically move a URL PENDING → PROCESSING (incrementing attempt_count)
     * and lift its batch PENDING → PROCESSING. Returns the URL string if this
     * caller won the claim, or null if the row was not PENDING (already claimed,
     * terminal, or cancelled) - in which case the worker must not do the work.
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
        const lifted = await tx`
          UPDATE batches
          SET status = 'PROCESSING', started_at = COALESCE(started_at, now()), updated_at = now()
          WHERE id = ${row.batch_id} AND status = 'PENDING'
        `;
        return { url: row.url, batchActivated: lifted.count > 0 };
      });
    },

    /**
     * Persist a terminal result for a URL that is still PROCESSING, bump the
     * matching batch counter, and - if the batch is now fully accounted for -
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
        // Lock the row and capture prior state (title for TITLE_CHANGED, owner
        // for alert rows) before overwriting it. The PROCESSING guard preserves
        // the "skipped" idempotency semantics.
        const [prior] = await tx<{ url: string; batch_id: string; user_id: string | null; page_title: string | null }[]>`
          SELECT u.url, u.batch_id, u.page_title, b.user_id
          FROM urls u JOIN batches b ON b.id = u.batch_id
          WHERE u.id = ${urlId} AND u.status = 'PROCESSING'
          FOR UPDATE OF u
        `;
        if (!prior) return { outcome: "skipped", batchFinalized: false };

        await tx`
          UPDATE urls
          SET status = ${result.status},
              http_status = ${result.httpStatus},
              response_time_ms = ${result.responseTimeMs},
              page_title = ${result.pageTitle},
              error_code = ${result.errorCode},
              error_message = ${result.errorMessage},
              completed_at = now(),
              updated_at = now()
          WHERE id = ${urlId}
        `;

        if (result.status === "SUCCESS") {
          await tx`UPDATE batches SET completed_count = completed_count + 1, updated_at = now() WHERE id = ${prior.batch_id}`;
        } else {
          await tx`UPDATE batches SET failed_count = failed_count + 1, updated_at = now() WHERE id = ${prior.batch_id}`;
        }

        const finalized = await tx`
          UPDATE batches
          SET status = CASE WHEN failed_count > 0 THEN 'FAILED' ELSE 'COMPLETED' END,
              completed_at = now(),
              updated_at = now()
          WHERE id = ${prior.batch_id}
            AND status = 'PROCESSING'
            AND completed_count + failed_count + cancelled_count >= total_count
        `;

        // Alerts are derived and written in THIS transaction, so they commit
        // atomically with the (once-only) result write.
        const [openFailure] = await tx<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM alerts
            WHERE url_id = ${urlId} AND status <> 'resolved'
              AND type = ANY(${FAILURE_ALERT_TYPES})
          ) AS exists
        `;
        const { inserts, resolveOpenFailures } = deriveAlerts(result, {
          previousTitle: prior.page_title,
          hadOpenFailure: openFailure?.exists ?? false,
          slowThresholdMs: alertOptions.slowThresholdMs,
          sslWarnDays: alertOptions.sslWarnDays,
          now: new Date(),
        });

        if (resolveOpenFailures) {
          await tx`
            UPDATE alerts SET status = 'resolved', updated_at = now()
            WHERE url_id = ${urlId} AND status <> 'resolved' AND type = ANY(${FAILURE_ALERT_TYPES})
          `;
        }
        for (const a of inserts) {
          // De-duplicate open alerts of the same (url, type) via the partial
          // unique index, so re-checking a still-broken URL adds no duplicate.
          await tx`
            INSERT INTO alerts (user_id, batch_id, url_id, url, type, title, detail, severity)
            VALUES (${prior.user_id}, ${prior.batch_id}, ${urlId}, ${prior.url}, ${a.type}, ${a.title}, ${a.detail}, ${a.severity})
            ON CONFLICT (url_id, type) WHERE status <> 'resolved' DO NOTHING
          `;
        }
        return { outcome: "applied", batchFinalized: finalized.count > 0 };
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

    /**
     * Crash recovery (INV-11): reclaim URLs that have been PROCESSING longer than
     * `olderThanMs` in a still-active batch back to PENDING, so a worker that
     * crashed after claiming but before persisting does not strand a URL. Bounded
     * by the started_at threshold so an in-flight check is never reclaimed. Safe
     * to run repeatedly. Returns the number reclaimed.
     */
    async recoverStuck(olderThanMs) {
      const rows = await db`
        UPDATE urls u
        SET status = 'PENDING', started_at = NULL, updated_at = now()
        FROM batches b
        WHERE u.batch_id = b.id
          AND u.status = 'PROCESSING'
          AND b.status = 'PROCESSING'
          AND u.started_at < now() - make_interval(secs => ${olderThanMs} / 1000.0)
      `;
      return rows.count;
    },
  };
}
