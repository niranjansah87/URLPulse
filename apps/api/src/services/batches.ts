import {
  createBatchRequestSchema,
  type BatchDetail,
  type BatchListMeta,
  type BatchSummary,
  type ListBatchesQuery,
  type UrlCheckJobData,
} from "@urlpulse/types";
import type { BatchRepository } from "../repositories/batches";
import type { BatchListCache } from "../lib/cache";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";

/** Minimal logger surface (satisfied by Fastify's `app.log`). */
export interface ServiceLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
}

/** Enqueue one URL-check job. Injected so the service is testable without Redis. */
export type EnqueuePort = (data: UrlCheckJobData) => Promise<void>;

/** Publish a batch.updated notification (best-effort; never fails a mutation). */
export type PublishPort = (batchId: string) => Promise<void>;

export interface BatchServiceDeps {
  repo: BatchRepository;
  enqueue: EnqueuePort;
  publish?: PublishPort;
  cache?: BatchListCache;
  /** Age after which a PROCESSING URL is considered stuck and reclaimed. */
  stuckProcessingMs?: number;
  log: ServiceLogger;
}

/**
 * Application logic for batches. Routes stay thin; this owns the create →
 * persist → enqueue orchestration and the ADR-028 consistency behavior:
 * PostgreSQL is committed first and is the source of truth; a failed enqueue is
 * logged and left for the reconciliation sweep, never hidden by deleting rows.
 */
export function createBatchService({
  repo,
  enqueue,
  publish,
  cache,
  stuckProcessingMs = 60_000,
  log,
}: BatchServiceDeps) {
  async function notify(batchId: string): Promise<void> {
    if (!publish) return;
    // A failed notification must not roll back or fail a committed mutation
    // (ADR-005): the DB is authoritative and clients reconcile on reconnect.
    await publish(batchId).catch((err) =>
      log.warn({ batchId, err: (err as Error).message }, "batch.updated publish failed"),
    );
  }

  async function enqueueAll(jobs: UrlCheckJobData[]): Promise<number> {
    let enqueued = 0;
    for (const job of jobs) {
      try {
        await enqueue(job);
        enqueued += 1;
      } catch (err) {
        // Do NOT fail the request or delete rows: the batch is durably persisted
        // and the reconciliation sweep will re-enqueue this URL (ADR-028).
        log.warn(
          { batchId: job.batchId, urlId: job.urlId, err: (err as Error).message },
          "enqueue failed; left for reconciliation",
        );
      }
    }
    return enqueued;
  }

  return {
    /**
     * Validate input, persist the batch + URL rows transactionally, then enqueue
     * one job per URL. Accepts already-extracted URLs from either the JSON body
     * or a parsed CSV - both converge here so validation cannot diverge.
     */
    async createBatch(userId: string, input: { urls: unknown }): Promise<BatchSummary> {
      const parsed = createBatchRequestSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError("Invalid URL input", parsed.error.issues);
      }

      const { batch, urlIds } = await repo.createWithUrls(userId, parsed.data.urls);
      const jobs = urlIds.map((urlId) => ({ batchId: batch.id, urlId }));
      const enqueued = await enqueueAll(jobs);
      await cache?.invalidate(); // a new batch must appear immediately (INV-13)

      log.info(
        { batchId: batch.id, urlCount: urlIds.length, enqueued },
        "batch created",
      );
      return batch;
    },

    async getBatch(userId: string, id: string): Promise<BatchDetail> {
      const batch = await repo.getById(userId, id);
      if (!batch) throw new NotFoundError(`Batch ${id} not found`);
      return batch;
    },

    /**
     * Cancel a batch. Idempotent: re-cancelling or cancelling an
     * already-terminal batch returns the current authoritative state rather than
     * erroring (api.md §14). Returns 404 only when the batch does not exist.
     */
    async cancelBatch(userId: string, id: string): Promise<BatchDetail> {
      const result = await repo.cancel(userId, id);
      if (result === "notfound") throw new NotFoundError(`Batch ${id} not found`);
      log.info({ batchId: id, result }, "batch cancel");
      if (result === "cancelled") {
        await cache?.invalidate();
        await notify(id);
      }
      const batch = await repo.getById(userId, id);
      if (!batch) throw new NotFoundError(`Batch ${id} not found`);
      return batch;
    },

    async listBatches(
      userId: string,
      query: ListBatchesQuery,
    ): Promise<{ items: BatchSummary[]; meta: BatchListMeta }> {
      const cached = await cache?.get(userId, query);
      if (cached) return cached;
      const { items, total } = await repo.list(userId, query);
      const value = { items, meta: { page: query.page, pageSize: query.pageSize, total } };
      await cache?.set(userId, query, value);
      return value;
    },

    /**
     * Retry the FAILED URLs of a batch (ADR-024). Resets them to PENDING and
     * enqueues one job each; other URLs are untouched. Rejects a CANCELLED batch
     * with 409 (ADR-027) and a missing batch with 404. Idempotent under
     * concurrent calls (the DB claims each FAILED row once).
     */
    async retryFailed(userId: string, id: string): Promise<BatchDetail> {
      const result = await repo.retryFailed(userId, id);
      if (result === "notfound") throw new NotFoundError(`Batch ${id} not found`);
      if (result === "cancelled") throw new ConflictError(`Batch ${id} is cancelled and cannot be retried`);

      const jobs = result.claimed.map((urlId) => ({ batchId: id, urlId }));
      const enqueued = await enqueueAll(jobs);
      log.info({ batchId: id, retried: result.claimed.length, enqueued }, "retry-failed");
      if (result.claimed.length > 0) {
        await cache?.invalidate();
        await notify(id);
      }

      const batch = await repo.getById(userId, id);
      if (!batch) throw new NotFoundError(`Batch ${id} not found`);
      return batch;
    },

    /**
     * Re-enqueue every PENDING URL in a non-terminal batch. Idempotent (jobId =
     * urlId), so running it repeatedly is safe. This is the recovery path for the
     * commit-then-enqueue-fails window (ADR-028). Scheduling it on an interval is
     * a later (hardening) concern; the operation itself lives here.
     */
    async reconcile(): Promise<{ recovered: number; reEnqueued: number }> {
      // First reclaim URLs stranded in PROCESSING by a crashed worker (they
      // become PENDING), then re-enqueue every PENDING URL that has no live job.
      // Both steps are idempotent, so concurrent API instances are safe.
      const recovered = await repo.recoverStuck(stuckProcessingMs);
      const jobs = await repo.findReconcilableJobs();
      const reEnqueued = await enqueueAll(jobs);
      if (recovered > 0 || jobs.length > 0) {
        log.info({ recovered, candidates: jobs.length, reEnqueued }, "reconciliation sweep");
      }
      return { recovered, reEnqueued };
    },
  };
}

export type BatchService = ReturnType<typeof createBatchService>;
