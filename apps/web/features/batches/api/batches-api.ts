import type { BatchDetail, BatchListMeta, BatchSummary, ListBatchesQuery, SseBatchUpdated } from "@urlpulse/types";
import { SSE_EVENT_BATCH_UPDATED } from "@urlpulse/types";
import { api, API_BASE } from "@/lib/api";

/** Extra request options; server callers pass forwarded cookies via `headers`. */
export interface CallOptions {
  headers?: Record<string, string>;
}

/**
 * Typed calls to the real Fastify batch endpoints (docs/03-backend/api.md).
 * Returns shared DTOs from @urlpulse/types; view mapping lives in ../lib.
 */
export const batchesApi = {
  async list(query: Partial<ListBatchesQuery> = {}, opts: CallOptions = {}): Promise<{ items: BatchSummary[]; meta: BatchListMeta }> {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.pageSize) params.set("pageSize", String(query.pageSize));
    const qs = params.toString();
    const { data, meta } = await api.get<BatchSummary[]>(`/batches${qs ? `?${qs}` : ""}`, opts);
    return { items: data, meta: meta as unknown as BatchListMeta };
  },

  async get(batchId: string, opts: CallOptions = {}): Promise<BatchDetail> {
    const { data } = await api.get<BatchDetail>(`/batches/${encodeURIComponent(batchId)}`, opts);
    return data;
  },

  async create(urls: string[]): Promise<BatchSummary> {
    const { data } = await api.post<BatchSummary>("/batches", { urls });
    return data;
  },

  async createFromCsv(file: File): Promise<BatchSummary> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<BatchSummary>("/batches", form);
    return data;
  },

  async cancel(batchId: string): Promise<BatchDetail> {
    const { data } = await api.post<BatchDetail>(`/batches/${encodeURIComponent(batchId)}/cancel`);
    return data;
  },

  async retryFailed(batchId: string): Promise<BatchDetail> {
    const { data } = await api.post<BatchDetail>(`/batches/${encodeURIComponent(batchId)}/retry-failed`);
    return data;
  },

  /**
   * Subscribe to live `batch.updated` notifications. Events are notifications
   * only (ADR-005): the caller refetches authoritative state. Returns a
   * disposer. EventSource reconnects on its own; `onStateChange` reports it.
   */
  subscribe(
    batchId: string,
    onUpdate: (payload: SseBatchUpdated) => void,
    onStateChange?: (state: "live" | "reconnecting") => void,
  ): () => void {
    const source = new EventSource(`${API_BASE}/batches/${encodeURIComponent(batchId)}/events`, { withCredentials: true });
    source.addEventListener(SSE_EVENT_BATCH_UPDATED, (e) => {
      try {
        onUpdate(JSON.parse((e as MessageEvent).data) as SseBatchUpdated);
      } catch {
        /* malformed notification - ignore; next refetch reconciles */
      }
    });
    source.onopen = () => onStateChange?.("live");
    source.onerror = () => onStateChange?.("reconnecting");
    return () => source.close();
  },
};
