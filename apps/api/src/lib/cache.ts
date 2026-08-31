import type { BatchListMeta, BatchSummary, ListBatchesQuery } from "@urlpulse/types";

/**
 * Batch-list cache (ADR-012). A read-through Redis cache with a 30s TTL. Redis is
 * NOT authoritative: every method degrades to a cache miss / no-op on Redis
 * failure so the API keeps serving from PostgreSQL.
 *
 * Invalidation is version-based: a counter key is INCR'd on every relevant
 * mutation, and the counter is part of each cache key. Bumping it orphans all
 * previous pages at once (they expire via TTL) and makes the next read a miss —
 * immediate invalidation without SCAN/DEL. Per-URL progress changes are NOT
 * invalidated (they would defeat the cache); the 30s TTL bounds that staleness,
 * while creation, cancellation, and retry-failed invalidate immediately.
 */
export type BatchListValue = { items: BatchSummary[]; meta: BatchListMeta };

export interface BatchListCache {
  get(query: ListBatchesQuery): Promise<BatchListValue | null>;
  set(query: ListBatchesQuery, value: BatchListValue): Promise<void>;
  invalidate(): Promise<void>;
}

export interface CacheRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  incr(key: string): Promise<number>;
}

const PREFIX = "cache:batches:list";
const VERSION_KEY = "cache:batches:list:ver";

export function createBatchListCache(redis: CacheRedis, ttlSeconds: number): BatchListCache {
  const keyFor = (version: string, q: ListBatchesQuery): string =>
    `${PREFIX}:v${version}:${q.page}:${q.pageSize}`;

  return {
    async get(query) {
      try {
        const version = (await redis.get(VERSION_KEY)) ?? "0";
        const raw = await redis.get(keyFor(version, query));
        return raw ? (JSON.parse(raw) as BatchListValue) : null;
      } catch {
        return null; // degrade to a DB read
      }
    },
    async set(query, value) {
      try {
        const version = (await redis.get(VERSION_KEY)) ?? "0";
        await redis.set(keyFor(version, query), JSON.stringify(value), "EX", ttlSeconds);
      } catch {
        // best-effort; a failed cache write just means the next read is a miss
      }
    },
    async invalidate() {
      try {
        await redis.incr(VERSION_KEY);
      } catch {
        // if we cannot bump the version, entries still expire within the TTL
      }
    },
  };
}
