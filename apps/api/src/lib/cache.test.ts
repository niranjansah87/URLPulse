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
    const miss = await cache.get(USER, query);
    expect(miss.value).toBeNull();
    await cache.set(USER, query, value, miss.version);
    expect((await cache.get(USER, query)).value).toEqual(value);
  });

  it("invalidation makes the previously cached page a miss", async () => {
    const cache = createBatchListCache(memoryRedis(), 30);
    const read = await cache.get(USER, query);
    await cache.set(USER, query, value, read.version);
    await cache.invalidate();
    expect((await cache.get(USER, query)).value).toBeNull();
  });

  it("sets the value with the configured TTL", async () => {
    const redis = memoryRedis();
    const cache = createBatchListCache(redis, 30);
    const read = await cache.get(USER, query);
    await cache.set(USER, query, value, read.version);
    expect(redis.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), "EX", 30);
  });

  it("does not serve one user's cached page to another user", async () => {
    const cache = createBatchListCache(memoryRedis(), 30);
    const read = await cache.get(USER, query);
    await cache.set(USER, query, value, read.version);
    expect((await cache.get("other-user", query)).value).toBeNull();
    expect((await cache.get(USER, query)).value).toEqual(value);
  });

  it("does not mask an invalidation that races the read (writes under the read's version)", async () => {
    const cache = createBatchListCache(memoryRedis(), 30);
    const read = await cache.get(USER, query); // miss at version 0
    await cache.invalidate(); // version -> 1, between the read and the write
    await cache.set(USER, query, value, read.version); // must land under the orphaned version 0
    expect((await cache.get(USER, query)).value).toBeNull(); // read at version 1 stays a miss
  });

  it("skips caching when the read could not observe a version (null)", async () => {
    const redis = memoryRedis();
    const cache = createBatchListCache(redis, 30);
    await cache.set(USER, query, value, null);
    expect(redis.set).not.toHaveBeenCalled();
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
    await expect(cache.get(USER, query)).resolves.toEqual({ value: null, version: null });
    await expect(cache.set(USER, query, value, "0")).resolves.toBeUndefined();
    await expect(cache.invalidate()).resolves.toBeUndefined();
  });
});
