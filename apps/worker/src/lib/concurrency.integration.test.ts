import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Redis } from "ioredis";
import { createConcurrencyLimiter, type RedisSemaphoreClient } from "./concurrency";

/**
 * Distributed invariant test (INV-3). Runs many concurrent acquisitions against a
 * REAL Redis semaphore and asserts the number simultaneously held never exceeds
 * the limit. Because the count lives in Redis, this proves the limit is global,
 * not per-process. Self-skips when Redis is unavailable — it does NOT prove the
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
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!redisUp)("distributed concurrency limit (integration)", () => {
  const redis = new Redis(REDIS_URL);
  const key = `sem:test:${Date.now()}`;

  beforeAll(async () => {
    await redis.del(key);
  });
  afterAll(async () => {
    await redis.del(key);
    await redis.quit();
  });

  it("never allows more than the limit in flight across concurrent acquirers", async () => {
    const limit = 5;
    const limiter = createConcurrencyLimiter(redis as unknown as RedisSemaphoreClient, {
      limit,
      leaseTtlMs: 5_000,
      key,
      pollMs: 5,
    });

    let inFlight = 0;
    let max = 0;
    await Promise.all(
      Array.from({ length: 40 }, async () => {
        const slot = await limiter.acquire();
        inFlight += 1;
        max = Math.max(max, inFlight);
        await sleep(5 + Math.floor(Math.random() * 15));
        inFlight -= 1;
        await slot.release();
      }),
    );

    // Never exceeds the global limit, and under 40-way contention it actually
    // saturates it (proving it is not accidentally under-admitting).
    expect(max).toBeLessThanOrEqual(limit);
    expect(max).toBe(limit);
  });

  it("reclaims a crashed worker's slot after the lease TTL (no permanent lock)", async () => {
    const limit = 3;
    const crashKey = `${key}:crash`;
    await redis.del(crashKey);
    // A short TTL so the test is fast; in production TTL > max request time.
    const limiter = createConcurrencyLimiter(redis as unknown as RedisSemaphoreClient, {
      limit,
      leaseTtlMs: 400,
      key: crashKey,
      pollMs: 10,
    });

    // Fill every slot and NEVER release — simulating `limit` crashed workers.
    for (let i = 0; i < limit; i += 1) await limiter.acquire();

    // Wait past the lease TTL: the leases expire and slots are reclaimable.
    await sleep(600);
    const recovered = await limiter.acquire();
    expect(recovered).toBeDefined();
    await recovered.release();
    await redis.del(crashKey);
  });
});
