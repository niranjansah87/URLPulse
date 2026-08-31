import { describe, it, expect, vi } from "vitest";
import { createRateLimiter, type RedisEval } from "./rate-limiter";

function evalReturning(values: number[]): RedisEval {
  let i = 0;
  return { eval: vi.fn(async () => values[Math.min(i++, values.length - 1)]) };
}

const opts = { limit: 10, windowMs: 1000, key: "rl:test", token: () => "t", sleep: async () => {} };

describe("createRateLimiter", () => {
  it("admits immediately when the script returns -1", async () => {
    const redis = evalReturning([-1]);
    await createRateLimiter(redis, opts).acquire();
    expect(redis.eval).toHaveBeenCalledOnce();
  });

  it("waits and retries while denied, then admits", async () => {
    const redis = evalReturning([250, 100, -1]);
    const sleeps: number[] = [];
    await createRateLimiter(redis, { ...opts, sleep: async (ms) => void sleeps.push(ms) }).acquire();
    expect(redis.eval).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
  });

  it("passes the configured key, limit and window to the script", async () => {
    const redis = evalReturning([-1]);
    await createRateLimiter(redis, opts).acquire();
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, "rl:test", 10, 1000, "t");
  });

  it("propagates a Redis failure instead of admitting (no local bypass)", async () => {
    const redis: RedisEval = {
      eval: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    await expect(createRateLimiter(redis, opts).acquire()).rejects.toThrow("redis down");
  });
});
