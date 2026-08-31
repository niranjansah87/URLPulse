import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { BatchRepository } from "../repositories/batches";

// Config is validated at import time; provide safe test values first.
process.env.DATABASE_URL ??= "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";
process.env.REDIS_URL ??= "redis://localhost:6379";

const { buildServer } = await import("../server");
const { createBatchService } = await import("../services/batches");

let app: ReturnType<typeof buildServer>;

beforeAll(async () => {
  // Inject a service backed by a repo that never touches a DB. The tests below
  // only reach validation/routing, which run before any repo/queue access, so
  // no PostgreSQL or Redis is required.
  const repo = {
    createWithUrls: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    cancel: vi.fn(),
    retryFailed: vi.fn(),
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

// These exercise the wired route + error handler. Validation runs before any DB
// or queue access, so they need no infrastructure.

describe("POST /api/batches validation", () => {
  it("rejects a body with no urls field", async () => {
    const res = await app.inject({ method: "POST", url: "/api/batches", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/batches",
      payload: { urls: ["not-a-url"] },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/batches/:batchId", () => {
  it("returns 404 for a non-UUID batch id without hitting the database", async () => {
    const res = await app.inject({ method: "GET", url: "/api/batches/not-a-uuid" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/batches/:batchId/cancel", () => {
  it("returns 404 for a non-UUID batch id", async () => {
    const res = await app.inject({ method: "POST", url: "/api/batches/not-a-uuid/cancel" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});

describe("unimplemented endpoints", () => {
  it("returns 501 for the SSE events endpoint", async () => {
    const res = await app.inject({ method: "GET", url: "/api/batches/x/events" });
    expect(res.statusCode).toBe(501);
    expect(res.json().error.code).toBe("NOT_IMPLEMENTED");
  });
});
