import { describe, it, expect, vi } from "vitest";
import type { BatchDetail, BatchSummary, UrlCheckJobData } from "@urlpulse/types";
import { createBatchService } from "./batches";
import type { BatchRepository } from "../repositories/batches";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";

const noopLog = { info: () => {}, warn: () => {} };

function summary(id: string): BatchSummary {
  return {
    id,
    status: "PENDING",
    totalCount: 2,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    createdAt: new Date().toISOString(),
  };
}

function fakeRepo(over: Partial<BatchRepository> = {}): BatchRepository {
  return {
    createWithUrls: vi.fn(async (urls: string[]) => ({
      batch: summary("batch-1"),
      urlIds: urls.map((_, i) => `url-${i}`),
    })),
    getById: vi.fn(async () => null),
    list: vi.fn(async () => ({ items: [], total: 0 })),
    cancel: vi.fn(async () => "cancelled" as const),
    retryFailed: vi.fn(async () => ({ claimed: [] })),
    findReconcilableJobs: vi.fn(async () => []),
    ...over,
  } as BatchRepository;
}

describe("batchService.createBatch", () => {
  it("persists then enqueues exactly one job per URL with an ids-only payload", async () => {
    const enqueued: UrlCheckJobData[] = [];
    const repo = fakeRepo();
    const service = createBatchService({
      repo,
      enqueue: async (d) => void enqueued.push(d),
      log: noopLog,
    });

    await service.createBatch({ urls: ["https://a.com", "https://b.com"] });

    expect(enqueued).toEqual([
      { batchId: "batch-1", urlId: "url-0" },
      { batchId: "batch-1", urlId: "url-1" },
    ]);
  });

  it("rejects invalid URLs before touching the database", async () => {
    const repo = fakeRepo();
    const service = createBatchService({ repo, enqueue: async () => {}, log: noopLog });

    await expect(service.createBatch({ urls: ["not-a-url"] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(repo.createWithUrls).not.toHaveBeenCalled();
  });

  it("rejects unsupported URL schemes", async () => {
    const service = createBatchService({ repo: fakeRepo(), enqueue: async () => {}, log: noopLog });
    await expect(service.createBatch({ urls: ["ftp://a.com"] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("returns the created batch even when every enqueue fails (rows are not deleted)", async () => {
    const repo = fakeRepo();
    const service = createBatchService({
      repo,
      enqueue: async () => {
        throw new Error("redis down");
      },
      log: noopLog,
    });

    const batch = await service.createBatch({ urls: ["https://a.com"] });

    expect(batch.id).toBe("batch-1");
    expect(repo.createWithUrls).toHaveBeenCalledOnce();
  });
});

describe("batchService.getBatch", () => {
  it("throws NotFoundError for an unknown batch", async () => {
    const service = createBatchService({ repo: fakeRepo(), enqueue: async () => {}, log: noopLog });
    await expect(service.getBatch("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns the persisted batch detail", async () => {
    const detail: BatchDetail = { ...summary("batch-1"), urls: [] };
    const repo = fakeRepo({ getById: vi.fn(async () => detail) });
    const service = createBatchService({ repo, enqueue: async () => {}, log: noopLog });
    await expect(service.getBatch("batch-1")).resolves.toEqual(detail);
  });
});

describe("batchService.cancelBatch", () => {
  it("throws NotFoundError when the batch does not exist", async () => {
    const repo = fakeRepo({ cancel: vi.fn(async () => "notfound" as const) });
    const service = createBatchService({ repo, enqueue: async () => {}, log: noopLog });
    await expect(service.cancelBatch("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns authoritative state after cancelling", async () => {
    const detail: BatchDetail = { ...summary("batch-1"), status: "CANCELLED", urls: [] };
    const repo = fakeRepo({
      cancel: vi.fn(async () => "cancelled" as const),
      getById: vi.fn(async () => detail),
    });
    const service = createBatchService({ repo, enqueue: async () => {}, log: noopLog });
    await expect(service.cancelBatch("batch-1")).resolves.toEqual(detail);
  });

  it("is idempotent for an already-terminal batch (noop returns current state)", async () => {
    const detail: BatchDetail = { ...summary("batch-1"), status: "COMPLETED", urls: [] };
    const repo = fakeRepo({
      cancel: vi.fn(async () => "noop" as const),
      getById: vi.fn(async () => detail),
    });
    const service = createBatchService({ repo, enqueue: async () => {}, log: noopLog });
    await expect(service.cancelBatch("batch-1")).resolves.toEqual(detail);
  });
});

describe("batchService.retryFailed", () => {
  it("throws NotFoundError when the batch does not exist", async () => {
    const repo = fakeRepo({ retryFailed: vi.fn(async () => "notfound" as const) });
    const service = createBatchService({ repo, enqueue: async () => {}, log: noopLog });
    await expect(service.retryFailed("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError for a cancelled batch", async () => {
    const repo = fakeRepo({ retryFailed: vi.fn(async () => "cancelled" as const) });
    const service = createBatchService({ repo, enqueue: async () => {}, log: noopLog });
    await expect(service.retryFailed("batch-1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("enqueues one job per claimed failed URL and returns state", async () => {
    const enqueued: string[] = [];
    const detail: BatchDetail = { ...summary("batch-1"), urls: [] };
    const repo = fakeRepo({
      retryFailed: vi.fn(async () => ({ claimed: ["u-b", "u-d"] })),
      getById: vi.fn(async () => detail),
    });
    const service = createBatchService({
      repo,
      enqueue: async (d) => void enqueued.push(d.urlId),
      log: noopLog,
    });
    await service.retryFailed("batch-1");
    expect(enqueued).toEqual(["u-b", "u-d"]);
  });
});

describe("batchService.reconcile", () => {
  it("re-enqueues every pending job returned by the repository", async () => {
    const jobs: UrlCheckJobData[] = [
      { batchId: "b1", urlId: "u1" },
      { batchId: "b1", urlId: "u2" },
    ];
    const enqueued: UrlCheckJobData[] = [];
    const repo = fakeRepo({ findReconcilableJobs: vi.fn(async () => jobs) });
    const service = createBatchService({
      repo,
      enqueue: async (d) => void enqueued.push(d),
      log: noopLog,
    });

    const result = await service.reconcile();

    expect(result.reEnqueued).toBe(2);
    expect(enqueued).toEqual(jobs);
  });
});
