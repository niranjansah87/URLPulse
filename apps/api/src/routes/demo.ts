import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { ApiError, ApiSuccess } from "@urlpulse/types";
import { createRateLimiter, type RateLimiter, type RedisEval } from "@urlpulse/outbound";
import { config } from "../lib/env";
import { ValidationError } from "../lib/errors";
import { checkOne, type DemoCheckResult } from "../lib/demo-check";

interface DemoRoutesOptions {
  redis: Redis;
  /** Injectable for tests; defaults to the real SSRF-guarded, permit-gated checker. */
  check?: (url: string) => Promise<DemoCheckResult>;
}

/** Landing-page demo lets anyone try a few checks. Never persists, never enqueues. */
const MAX_URLS = 5;
const RATE_WINDOW_SEC = 60;
const RATE_MAX_REQUESTS = 3;
/** Upper bound on how long one URL waits for a global permit before giving up. */
const PERMIT_WAIT_MS = 5000;

/** Wait for a global permit, but never longer than `ms` so a saturated limiter cannot hang the request. */
async function acquireWithTimeout(limiter: RateLimiter, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("permit wait timed out")), ms);
  });
  try {
    await Promise.race([limiter.acquire(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Public, unauthenticated URL check for the marketing landing page. Abuse is
 * contained by three limits: at most MAX_URLS per request, a per-IP request
 * cap over a short window (Redis), and the SSRF guard + per-URL bounds inside
 * checkOne. Each outbound request also takes a global rate permit, so demo
 * traffic counts toward the system-wide budget (INV-4). Results are returned
 * inline and never stored.
 *
 * NOTE: rate limiting keys on `req.ip`. Set TRUST_PROXY=true when the API sits
 * behind a proxy/load balancer so `req.ip` is the real client, not the proxy.
 */
export async function registerDemoRoutes(app: FastifyInstance, opts: DemoRoutesOptions): Promise<void> {
  const { redis } = opts;

  // Shares the worker's global limiter (same key/limit/window).
  const rateLimiter = createRateLimiter(redis as unknown as RedisEval, {
    limit: config.RATE_LIMIT_RPS,
    windowMs: 1000,
    key: "rl:outbound",
  });
  const check = opts.check ?? ((url: string) => checkOne(url, () => acquireWithTimeout(rateLimiter, PERMIT_WAIT_MS)));

  app.post("/demo/checks", async (req, reply) => {
    const key = `demo:rl:${req.ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SEC);
    if (count > RATE_MAX_REQUESTS) {
      const ttl = await redis.ttl(key);
      const body: ApiError = {
        error: { code: "RATE_LIMITED", message: `Too many demo checks. Try again in ${ttl > 0 ? ttl : RATE_WINDOW_SEC}s, or sign up for unlimited checks.` },
      };
      reply.status(429).send(body);
      return;
    }

    const raw = (req.body as { urls?: unknown } | undefined)?.urls;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new ValidationError("Provide a non-empty list of URLs.");
    }
    const urls = raw.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim());
    if (urls.length === 0) {
      throw new ValidationError("Provide at least one valid URL.");
    }
    if (urls.length > MAX_URLS) {
      throw new ValidationError(`The demo checks up to ${MAX_URLS} URLs. Sign up to run larger batches.`);
    }

    // At most MAX_URLS (5) run concurrently - small and bounded per request.
    const results: DemoCheckResult[] = await Promise.all(urls.map(check));
    const body: ApiSuccess<DemoCheckResult[]> & { meta: { limit: number } } = { data: results, meta: { limit: MAX_URLS } };
    return body;
  });
}
