import { describe, it, expect, vi } from "vitest";
import { createBatchListCache, type CacheRedis } from "./cache";

const USER = "user-1";
const query = { page: 1, pageSize: 20 };
const value = { items: [], meta: { page: 1, pageSize: 20, total: 0 } };

/** In-memory Redis stand-in supporting get/set/incr. */
function memoryRedis(): CacheRedis {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    incr: vi.fn(async (k: string) => {
      const next = Number(store.get(k) ?? "0") + 1;
      store.set(k, String(next));
      return next;
    }),
  };
}

describe("createBatchListCache", () => {
  it("returns null on a miss and the stored value on a hit", async () => {
    const cache = createBatchListCache(memoryRedis(), 30);
    expect(await cache.get(USER, query)).toBeNull();
    await cache.set(USER, query, value);
    expect(await cache.get(USER, query)).toEqual(value);
  });

  it("invalidation makes the previously cached page a miss", async () => {
    const cache = createBatchListCache(memoryRedis(), 30);
    await cache.set(USER, query, value);
    await cache.invalidate();
    expect(await cache.get(USER, query)).toBeNull();
  });

  it("sets the value with the configured TTL", async () => {
    const redis = memoryRedis();
    await createBatchListCache(redis, 30).set(USER, query, value);
    expect(redis.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), "EX", 30);
  });

  it("does not serve one user's cached page to another user", async () => {
    const cache = createBatchListCache(memoryRedis(), 30);
    await cache.set(USER, query, value);
    expect(await cache.get("other-user", query)).toBeNull();
    expect(await cache.get(USER, query)).toEqual(value);
  });

  it("degrades to a miss when Redis fails (never throws)", async () => {
    const redis: CacheRedis = {
      get: vi.fn(async () => {
        throw new Error("redis down");
      }),
      set: vi.fn(async () => {
        throw new Error("redis down");
      }),
      incr: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    const cache = createBatchListCache(redis, 30);
    await expect(cache.get(USER, query)).resolves.toBeNull();
    await expect(cache.set(USER, query, value)).resolves.toBeUndefined();
    await expect(cache.invalidate()).resolves.toBeUndefined();
  });
});
