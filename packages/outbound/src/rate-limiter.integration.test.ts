import { describe, it, expect, afterAll } from "vitest";
import { Redis } from "ioredis";
import { createRateLimiter, type RedisEval } from "./rate-limiter";

/**
 * Distributed invariant test (INV-4). Fires many acquisitions against a REAL
 * Redis sliding-window limiter and asserts that in any 1s window no more than
 * `limit` requests were admitted. Because the window lives in Redis, this holds
 * across processes. Self-skips when Redis is unavailable — it does NOT prove the
 * guarantee unless it actually runs.
 */
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

async function reachable(): Promise<boolean> {
  const r = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await r.connect();
    await r.ping();
    return true;
  } catch {
    return false;
  } finally {
    r.disconnect();
  }
}

const redisUp = await reachable();

describe.skipIf(!redisUp)("distributed rate limit (integration)", () => {
  const redis = new Redis(REDIS_URL);
  const key = `rl:test:${Date.now()}`;

  afterAll(async () => {
    await redis.del(key);
    await redis.quit();
  });

  it("admits no more than the limit within any rolling 1s window", async () => {
    const limit = 10;
    const windowMs = 1000;
    const limiter = createRateLimiter(redis as unknown as RedisEval, { limit, windowMs, key });

    const admittedAt: number[] = [];
    await Promise.all(
      Array.from({ length: 25 }, async () => {
        await limiter.acquire();
        admittedAt.push(Date.now());
      }),
    );
    admittedAt.sort((a, b) => a - b);

    for (const t of admittedAt) {
      const inWindow = admittedAt.filter((x) => x > t - windowMs && x <= t).length;
      expect(inWindow).toBeLessThanOrEqual(limit);
    }
  }, 15_000);
});
