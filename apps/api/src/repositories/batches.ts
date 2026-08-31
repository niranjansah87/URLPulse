import type { BatchDetail, BatchSummary } from "@urlpulse/types";
import type { Db } from "../lib/db";
import { NotImplementedError } from "../lib/errors";

/**
 * Data-access layer for batches. Scaffolded signatures only; the SQL is written
 * in the next phase against the schema in docs/03-backend/database.md.
 */
export function createBatchRepository(_db: Db) {
  return {
    async list(): Promise<BatchSummary[]> {
      throw new NotImplementedError("batchRepository.list");
    },
    async getById(_id: string): Promise<BatchDetail | null> {
      throw new NotImplementedError("batchRepository.getById");
    },
  };
}

export type BatchRepository = ReturnType<typeof createBatchRepository>;
