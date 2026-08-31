import { describe, it, expect, vi } from "vitest";
import { createConcurrencyLimiter, type RedisSemaphoreClient } from "./concurrency";

function client(grants: number[]): RedisSemaphoreClient & { zrem: ReturnType<typeof vi.fn> } {
  let i = 0;
  return {
    eval: vi.fn(async () => grants[Math.min(i++, grants.length - 1)]),
    zrem: vi.fn(async () => 1),
  };
}

const opts = { limit: 5, leaseTtlMs: 30_000, key: "sem:test", token: () => "tok", sleep: async () => {} };

describe("createConcurrencyLimiter", () => {
  it("grants a slot immediately when the pool has room", async () => {
    const redis = client([1]);
    const slot = await createConcurrencyLimiter(redis, opts).acquire();
    expect(redis.eval).toHaveBeenCalledOnce();
    await slot.release();
    expect(redis.zrem).toHaveBeenCalledWith("sem:test", "tok");
  });

  it("polls until a slot frees up when the pool is full", async () => {
    const redis = client([0, 0, 1]);
    const sleeps: number[] = [];
    await createConcurrencyLimiter(redis, { ...opts, sleep: async (ms) => void sleeps.push(ms) }).acquire();
    expect(redis.eval).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
  });

  it("release is idempotent", async () => {
    const redis = client([1]);
    const slot = await createConcurrencyLimiter(redis, opts).acquire();
    await slot.release();
    await slot.release();
    expect(redis.zrem).toHaveBeenCalledOnce();
  });

  it("propagates a Redis failure instead of admitting locally", async () => {
    const redis: RedisSemaphoreClient = {
      eval: vi.fn(async () => {
        throw new Error("redis down");
      }),
      zrem: vi.fn(async () => 0),
    };
    await expect(createConcurrencyLimiter(redis, opts).acquire()).rejects.toThrow("redis down");
  });
});
