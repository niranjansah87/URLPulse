import type { BatchDetail, BatchSummary, CreateBatchRequest } from "@urlpulse/types";
import type { BatchRepository } from "../repositories/batches";
import { NotImplementedError } from "../lib/errors";

/**
 * Application logic for batches (validation orchestration, persistence +
 * enqueue, cancellation, retry-failed). Scaffolded signatures only.
 */
export function createBatchService(_repo: BatchRepository) {
  return {
    async createBatch(_input: CreateBatchRequest): Promise<BatchSummary> {
      throw new NotImplementedError("batchService.createBatch");
    },
    async listBatches(): Promise<BatchSummary[]> {
      throw new NotImplementedError("batchService.listBatches");
    },
    async getBatch(_id: string): Promise<BatchDetail | null> {
      throw new NotImplementedError("batchService.getBatch");
    },
  };
}

export type BatchService = ReturnType<typeof createBatchService>;
