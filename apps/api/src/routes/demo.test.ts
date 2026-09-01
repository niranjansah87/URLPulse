import { describe, expect, it } from "vitest";
import Fastify, { type FastifyError } from "fastify";

// Config loads at import time; provide the same fallbacks the other route tests use.
process.env.DATABASE_URL ??= "postgresql://urlpulse:urlpulse@localhost:5432/urlpulse";
process.env.REDIS_URL ??= "redis://localhost:6379";

const { registerDemoRoutes } = await import("./demo");
const { ApiDomainError } = await import("../lib/errors");
type DemoCheckResult = Awaited<ReturnType<typeof import("../lib/demo-check").checkOne>>;

/** In-memory stand-in for the Redis calls the route makes (incr/expire/ttl + eval). */
function fakeRedis() {
  const counts = new Map<string, number>();
  return {
    incr: async (k: string) => {
      const n = (counts.get(k) ?? 0) + 1;
      counts.set(k, n);
      return n;
    },
    expire: async () => 1,
    ttl: async () => 30,
    eval: async () => -1, // admit immediately
  };
}

const stubCheck = (url: string): Promise<DemoCheckResult> =>
  Promise.resolve({ url, ok: true, httpStatus: 200, responseTimeMs: 1, pageTitle: null, error: null });

async function buildApp(check = stubCheck) {
  const app = Fastify();
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    const status = err instanceof ApiDomainError ? err.statusCode : (err.statusCode ?? 500);
    reply.status(status).send({ error: { code: (err as { code?: string }).code ?? "ERROR", message: err.message } });
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(registerDemoRoutes, { redis: fakeRedis() as any, check });
  return app;
}

async function post(app: Awaited<ReturnType<typeof buildApp>>, urls: unknown) {
  return app.inject({ method: "POST", url: "/demo/checks", payload: { urls } });
}

describe("POST /demo/checks", () => {
  it("returns a result per URL for a valid request", async () => {
    const app = await buildApp();
    const res = await post(app, ["https://example.com", "https://example.org"]);
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
    await app.close();
  });

  it("rejects an empty URL list with 400", async () => {
    const app = await buildApp();
    const res = await post(app, []);
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("rejects more than five URLs with 400", async () => {
    const app = await buildApp();
    const res = await post(app, Array.from({ length: 6 }, (_, i) => `https://s${i}.example.com`));
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 429 once the per-IP request cap is exceeded", async () => {
    const app = await buildApp();
    const codes: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      codes.push((await post(app, ["https://example.com"])).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 429]);
    await app.close();
  });
});
