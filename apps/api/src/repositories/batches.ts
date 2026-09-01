import type { BatchDetail, BatchSummary, UrlCheckJobData, UrlResult } from "@urlpulse/types";
import type { Db } from "../lib/db";

/**
 * Data-access layer for batches. The only place batch/url SQL lives; owns
 * transaction boundaries and returns domain DTOs (camelCase), never raw rows.
 * Schema: docs/03-backend/database.md.
 */

interface BatchRow {
  id: string;
  status: BatchSummary["status"];
  total_count: number;
  completed_count: number;
  failed_count: number;
  cancelled_count: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
}

interface UrlRow {
  id: string;
  url: string;
  status: UrlResult["status"];
  http_status: number | null;
  response_time_ms: number | null;
  page_title: string | null;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
}

function toBatchSummary(row: BatchRow): BatchSummary {
  return {
    id: row.id,
    status: row.status,
    totalCount: row.total_count,
    completedCount: row.completed_count,
    failedCount: row.failed_count,
    cancelledCount: row.cancelled_count,
    createdAt: row.created_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toUrlResult(row: UrlRow): UrlResult {
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    httpStatus: row.http_status,
    responseTimeMs: row.response_time_ms,
    pageTitle: row.page_title,
    error: row.error_message,
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export function createBatchRepository(db: Db) {
  return {
    /**
     * Insert a batch and its URL rows in a single transaction. Either the batch
     * plus every URL row is durably persisted, or nothing is (INV-1). Returns
     * the created batch summary and the new URL ids for enqueueing - enqueue
     * happens after commit, never inside the transaction (ADR-028).
     */
    async createWithUrls(
      userId: string,
      urls: string[],
    ): Promise<{ batch: BatchSummary; urlIds: string[] }> {
      return db.begin(async (tx) => {
        const [batchRow] = await tx<BatchRow[]>`
          INSERT INTO batches (status, total_count, user_id)
          VALUES ('PENDING', ${urls.length}, ${userId})
          RETURNING id, status, total_count, completed_count, failed_count, cancelled_count, created_at, started_at, completed_at, updated_at
        `;
        if (!batchRow) throw new Error("batch insert returned no row");
        const rows = urls.map((url) => ({ batch_id: batchRow.id, url }));
        const inserted = await tx<{ id: string }[]>`
          INSERT INTO urls ${tx(rows)}
          RETURNING id
        `;
        return { batch: toBatchSummary(batchRow), urlIds: inserted.map((r) => r.id) };
      });
    },

    async getById(userId: string, id: string): Promise<BatchDetail | null> {
      const [batchRow] = await db<BatchRow[]>`
        SELECT id, status, total_count, completed_count, failed_count, cancelled_count, created_at, started_at, completed_at, updated_at
        FROM batches WHERE id = ${id} AND user_id = ${userId}
      `;
      if (!batchRow) return null;
      const urlRows = await db<UrlRow[]>`
        SELECT id, url, status, http_status, response_time_ms, page_title, error_message, started_at, completed_at
        FROM urls WHERE batch_id = ${id} ORDER BY id
      `;
      return { ...toBatchSummary(batchRow), urls: urlRows.map(toUrlResult) };
    },

    async list(
      userId: string,
      params: { page: number; pageSize: number },
    ): Promise<{ items: BatchSummary[]; total: number }> {
      const offset = (params.page - 1) * params.pageSize;
      const countRows = await db<{ count: number }[]>`
        SELECT count(*)::int AS count FROM batches WHERE user_id = ${userId}
      `;
      const total = countRows[0]?.count ?? 0;
      const rows = await db<BatchRow[]>`
        SELECT id, status, total_count, completed_count, failed_count, cancelled_count, created_at, started_at, completed_at, updated_at
        FROM batches
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${params.pageSize} OFFSET ${offset}
      `;
      return { items: rows.map(toBatchSummary), total };
    },

    /**
     * Cancel a batch and its non-terminal URLs in one transaction (ADR-026).
     * Conditional on the batch being PENDING/PROCESSING so a COMPLETED/FAILED
     * batch is never reopened and a stale worker cannot reverse it. Bulk-cancels
     * PENDING/PROCESSING URLs (leaving SUCCESS/FAILED as-is) and bumps
     * cancelled_count by the number transitioned. Returns "notfound", "noop"
     * (already terminal; idempotent re-cancel), or "cancelled".
     */
    async cancel(userId: string, id: string): Promise<"cancelled" | "noop" | "notfound"> {
      return db.begin(async (tx) => {
        const [exists] = await tx<{ id: string }[]>`
          SELECT id FROM batches WHERE id = ${id} AND user_id = ${userId}
        `;
        if (!exists) return "notfound";
        const [changed] = await tx<{ id: string }[]>`
          UPDATE batches
          SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
          WHERE id = ${id} AND status IN ('PENDING', 'PROCESSING')
          RETURNING id
        `;
        if (!changed) return "noop";
        const cancelledUrls = await tx`
          UPDATE urls
          SET status = 'CANCELLED', completed_at = now(), updated_at = now()
          WHERE batch_id = ${id} AND status IN ('PENDING', 'PROCESSING')
        `;
        if (cancelledUrls.count > 0) {
          await tx`
            UPDATE batches SET cancelled_count = cancelled_count + ${cancelledUrls.count}, updated_at = now()
            WHERE id = ${id}
          `;
        }
        return "cancelled";
      });
    },

    /**
     * Reset a batch's FAILED URLs for another round (ADR-024). Atomically claims
     * every FAILED row to PENDING (resetting attempt_count and clearing the prior
     * result), decrements failed_count by the number claimed, and reactivates the
     * batch to PROCESSING. Concurrent calls are safe: the conditional UPDATE
     * claims each FAILED row once, so a second call finds none. Returns:
     *  - "notfound":  no such batch
     *  - "cancelled": batch is CANCELLED - retry-failed is rejected (ADR-027)
     *  - { claimed }: the URL ids reset (possibly empty), to be enqueued
     */
    async retryFailed(
      userId: string,
      id: string,
    ): Promise<"notfound" | "cancelled" | { claimed: string[] }> {
      return db.begin(async (tx) => {
        const [batch] = await tx<{ status: string }[]>`
          SELECT status FROM batches WHERE id = ${id} AND user_id = ${userId}
        `;
        if (!batch) return "notfound";
        if (batch.status === "CANCELLED") return "cancelled";
        const claimedRows = await tx<{ id: string }[]>`
          UPDATE urls
          SET status = 'PENDING', attempt_count = 0, http_status = NULL, response_time_ms = NULL,
              page_title = NULL, error_code = NULL, error_message = NULL,
              started_at = NULL, completed_at = NULL, updated_at = now()
          WHERE batch_id = ${id} AND status = 'FAILED'
          RETURNING id
        `;
        const claimed = claimedRows.map((r) => r.id);
        if (claimed.length > 0) {
          await tx`
            UPDATE batches
            SET failed_count = failed_count - ${claimed.length},
                status = 'PROCESSING', completed_at = NULL, updated_at = now()
            WHERE id = ${id}
          `;
        }
        return { claimed };
      });
    },

    /**
     * URLs still PENDING in a non-terminal batch - the set the reconciliation
     * sweep re-enqueues to close the commit-then-enqueue-fails window (ADR-028).
     */
    async findReconcilableJobs(): Promise<UrlCheckJobData[]> {
      const rows = await db<{ urlId: string; batchId: string }[]>`
        SELECT u.id AS "urlId", u.batch_id AS "batchId"
        FROM urls u
        JOIN batches b ON b.id = u.batch_id
        WHERE u.status = 'PENDING' AND b.status IN ('PENDING', 'PROCESSING')
      `;
      return rows.map((r) => ({ batchId: r.batchId, urlId: r.urlId }));
    },

    /**
     * Reclaim URLs stuck PROCESSING beyond a threshold in an active batch back to
     * PENDING (crash recovery, INV-11). Bounded by started_at so an in-flight
     * check is never reclaimed; idempotent. Returns the number reclaimed.
     */
    async recoverStuck(olderThanMs: number): Promise<number> {
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

export type BatchRepository = ReturnType<typeof createBatchRepository>;
