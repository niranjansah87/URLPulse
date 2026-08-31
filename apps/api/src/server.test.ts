import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { BatchRepository } from "./repositories/batches";

// Server config is validated at import time; provide safe test values first.
process.env.DATABASE_URL ??= "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";
process.env.REDIS_URL ??= "redis://localhost:6379";

const { buildServer } = await import("./server");
const { createBatchService } = await import("./services/batches");

let app: ReturnType<typeof buildServer>;

beforeAll(async () => {
  // Inject a service so buildServer does not open a BullMQ/Redis connection;
  // this test only exercises the infra-free /health route.
  const repo = {
    createWithUrls: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    findReconcilableJobs: vi.fn(),
  } as unknown as BatchRepository;
  const service = createBatchService({
    repo,
    enqueue: async () => {},
    log: { info: () => {}, warn: () => {} },
  });
  app = buildServer({ service });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("reports the API is alive without touching infrastructure", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("ok");
  });
});
