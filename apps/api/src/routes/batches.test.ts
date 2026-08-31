import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyRequest } from "fastify";
import type { BatchRepository } from "../repositories/batches";
import type { AuthUser } from "../lib/auth";
import { UnauthorizedError } from "../lib/errors";

// Config is validated at import time; provide safe test values first.
process.env.DATABASE_URL ??= "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";
process.env.REDIS_URL ??= "redis://localhost:6379";

const { buildServer } = await import("../server");
const { createBatchService } = await import("../services/batches");

const TEST_USER = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as AuthUser;

// Injected auth boundary that authenticates every request as TEST_USER, so the
// validation/routing tests below reach the handler without a real session.
const authAs = async (req: FastifyRequest): Promise<void> => {
  req.user = TEST_USER;
};

let app: ReturnType<typeof buildServer>;

function makeApp(requireAuth = authAs): ReturnType<typeof buildServer> {
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
  const eventBus = { start: async () => {}, addClient: () => () => {}, clientCount: () => 0 };
  return buildServer({ service, eventBus, requireAuth });
}

beforeAll(async () => {
  app = makeApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("batch routes require authentication", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const denied = makeApp(async () => {
      throw new UnauthorizedError();
    });
    await denied.ready();
    const res = await denied.inject({ method: "GET", url: "/api/batches" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
    await denied.close();
  });
});

// The configured web origin (env.ts default). State-changing requests must
// carry it, mirroring a real browser; the CSRF guard rejects everything else.
const ORIGIN = "http://localhost:3000";

// These exercise the wired route + error handler. Validation runs before any DB
// or queue access, so they need no infrastructure.

describe("POST /api/batches validation", () => {
  it("rejects a body with no urls field", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/batches",
      headers: { origin: ORIGIN },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid URL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/batches",
      headers: { origin: ORIGIN },
      payload: { urls: ["not-a-url"] },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("CSRF protection on state-changing routes", () => {
  it("rejects a POST from a cross-site origin with 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/batches",
      headers: { origin: "https://evil.example" },
      payload: { urls: ["https://a.com"] },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("rejects a POST with no Origin header with 403", async () => {
    const res = await app.inject({ method: "POST", url: "/api/batches", payload: { urls: ["https://a.com"] } });
    expect(res.statusCode).toBe(403);
  });

  it("allows a safe GET with no Origin header", async () => {
    const res = await app.inject({ method: "GET", url: "/api/batches/not-a-uuid" });
    expect(res.statusCode).toBe(404); // reaches the handler, not blocked by CSRF
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
    const res = await app.inject({
      method: "POST",
      url: "/api/batches/not-a-uuid/cancel",
      headers: { origin: ORIGIN },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/batches/:batchId/events", () => {
  it("returns 404 for a non-UUID batch id", async () => {
    const res = await app.inject({ method: "GET", url: "/api/batches/not-a-uuid/events" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});
