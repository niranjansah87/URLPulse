import type { BatchDetailData, BatchRow } from "../types";
import type { BatchListMeta } from "@urlpulse/types";
import { batchesApi, type CallOptions } from "../api/batches-api";
import { ApiClientError } from "@/lib/api";
import { toBatchDetailData, toBatchRow } from "./view";

/**
 * Data-access boundary for batch views, backed by the real API. Components and
 * pages depend on this interface only. `getBatchDetail` returns null for a
 * missing batch so pages can render not-found; other errors propagate as
 * ApiClientError for the error boundary / inline error states. Server callers
 * pass forwarded cookies in `opts.headers` (see lib/server-auth.ts).
 */
export interface BatchRepository {
  getBatchDetail(batchId: string, opts?: CallOptions): Promise<BatchDetailData | null>;
  listBatches(query?: { page?: number; pageSize?: number }, opts?: CallOptions): Promise<{ rows: BatchRow[]; meta: BatchListMeta }>;
}

export const batchRepository: BatchRepository = {
  async getBatchDetail(batchId, opts) {
    try {
      const detail = await batchesApi.get(batchId, opts);
      return toBatchDetailData(detail);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  },
  async listBatches(query = {}, opts) {
    const { items, meta } = await batchesApi.list(query, opts);
    return { rows: items.map(toBatchRow), meta };
  },
};
