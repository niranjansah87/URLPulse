import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Server config is validated at import time; provide safe test values first.
process.env.DATABASE_URL ??= "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";
process.env.REDIS_URL ??= "redis://localhost:6379";

const { buildServer } = await import("./server");

let app: ReturnType<typeof buildServer>;

beforeAll(async () => {
  app = buildServer();
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
