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
}

interface UrlRow {
  id: string;
  url: string;
  status: UrlResult["status"];
  http_status: number | null;
  response_time_ms: number | null;
  page_title: string | null;
  error_message: string | null;
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
    async createWithUrls(urls: string[]): Promise<{ batch: BatchSummary; urlIds: string[] }> {
      return db.begin(async (tx) => {
        const [batchRow] = await tx<BatchRow[]>`
          INSERT INTO batches (status, total_count)
          VALUES ('PENDING', ${urls.length})
          RETURNING id, status, total_count, completed_count, failed_count, cancelled_count, created_at
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

    async getById(id: string): Promise<BatchDetail | null> {
      const [batchRow] = await db<BatchRow[]>`
        SELECT id, status, total_count, completed_count, failed_count, cancelled_count, created_at
        FROM batches WHERE id = ${id}
      `;
      if (!batchRow) return null;
      const urlRows = await db<UrlRow[]>`
        SELECT id, url, status, http_status, response_time_ms, page_title, error_message
        FROM urls WHERE batch_id = ${id} ORDER BY id
      `;
      return { ...toBatchSummary(batchRow), urls: urlRows.map(toUrlResult) };
    },

    async list(params: { page: number; pageSize: number }): Promise<{
      items: BatchSummary[];
      total: number;
    }> {
      const offset = (params.page - 1) * params.pageSize;
      const countRows = await db<{ count: number }[]>`
        SELECT count(*)::int AS count FROM batches
      `;
      const total = countRows[0]?.count ?? 0;
      const rows = await db<BatchRow[]>`
        SELECT id, status, total_count, completed_count, failed_count, cancelled_count, created_at
        FROM batches
        ORDER BY created_at DESC
        LIMIT ${params.pageSize} OFFSET ${offset}
      `;
      return { items: rows.map(toBatchSummary), total };
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
  };
}

export type BatchRepository = ReturnType<typeof createBatchRepository>;
