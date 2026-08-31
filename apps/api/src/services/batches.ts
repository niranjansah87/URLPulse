import {
  createBatchRequestSchema,
  type BatchDetail,
  type BatchListMeta,
  type BatchSummary,
  type ListBatchesQuery,
  type UrlCheckJobData,
} from "@urlpulse/types";
import type { BatchRepository } from "../repositories/batches";
import { NotFoundError, ValidationError } from "../lib/errors";

/** Minimal logger surface (satisfied by Fastify's `app.log`). */
export interface ServiceLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
}

/** Enqueue one URL-check job. Injected so the service is testable without Redis. */
export type EnqueuePort = (data: UrlCheckJobData) => Promise<void>;

export interface BatchServiceDeps {
  repo: BatchRepository;
  enqueue: EnqueuePort;
  log: ServiceLogger;
}

/**
 * Application logic for batches. Routes stay thin; this owns the create →
 * persist → enqueue orchestration and the ADR-028 consistency behavior:
 * PostgreSQL is committed first and is the source of truth; a failed enqueue is
 * logged and left for the reconciliation sweep, never hidden by deleting rows.
 */
export function createBatchService({ repo, enqueue, log }: BatchServiceDeps) {
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
    async createBatch(input: { urls: unknown }): Promise<BatchSummary> {
      const parsed = createBatchRequestSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError("Invalid URL input", parsed.error.issues);
      }

      const { batch, urlIds } = await repo.createWithUrls(parsed.data.urls);
      const jobs = urlIds.map((urlId) => ({ batchId: batch.id, urlId }));
      const enqueued = await enqueueAll(jobs);

      log.info(
        { batchId: batch.id, urlCount: urlIds.length, enqueued },
        "batch created",
      );
      return batch;
    },

    async getBatch(id: string): Promise<BatchDetail> {
      const batch = await repo.getById(id);
      if (!batch) throw new NotFoundError(`Batch ${id} not found`);
      return batch;
    },

    async listBatches(
      query: ListBatchesQuery,
    ): Promise<{ items: BatchSummary[]; meta: BatchListMeta }> {
      const { items, total } = await repo.list(query);
      return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
    },

    /**
     * Re-enqueue every PENDING URL in a non-terminal batch. Idempotent (jobId =
     * urlId), so running it repeatedly is safe. This is the recovery path for the
     * commit-then-enqueue-fails window (ADR-028). Scheduling it on an interval is
     * a later (hardening) concern; the operation itself lives here.
     */
    async reconcile(): Promise<{ reEnqueued: number }> {
      const jobs = await repo.findReconcilableJobs();
      const reEnqueued = await enqueueAll(jobs);
      if (jobs.length > 0) {
        log.info({ candidates: jobs.length, reEnqueued }, "reconciliation sweep");
      }
      return { reEnqueued };
    },
  };
}

export type BatchService = ReturnType<typeof createBatchService>;
