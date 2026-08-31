/**
 * Global outbound concurrency limiter (INV-3): at most `limit` URL checks in
 * flight across ALL worker processes, not per process (ADR-007).
 *
 * Implemented as a Redis ZSET of active leases scored by expiry. Acquisition is
 * one atomic Lua script that first drops expired leases then admits only if
 * fewer than `limit` remain. Slots are TTL-leased (ADR-022): a live request
 * releases its slot in a finally, and a crashed worker's slot is reclaimed
 * automatically once its lease expires — so a crash cannot permanently consume a
 * slot or deadlock the pool. The TTL must exceed the maximum time a check can
 * hold a slot (see CONCURRENCY_LEASE_TTL_MS).
 *
 * Redis failure policy (ADR-020): acquisition throws rather than admitting
 * locally.
 */
export interface RedisSemaphoreClient {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  zrem(key: string, member: string): Promise<number>;
}

export interface ConcurrencyOptions {
  limit: number;
  leaseTtlMs: number;
  key: string;
  /** Poll interval when the pool is full (ms). */
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  token?: () => string;
}

export interface ConcurrencySlot {
  release(): Promise<void>;
}

export interface ConcurrencyLimiter {
  acquire(): Promise<ConcurrencySlot>;
}

// Returns 1 if a lease was granted, 0 if the pool is currently full.
const ACQUIRE = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local token = ARGV[3]
local t = redis.call('TIME')
local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', key, 0, now)
if redis.call('ZCARD', key) < limit then
  redis.call('ZADD', key, now + ttl, token)
  redis.call('PEXPIRE', key, ttl)
  return 1
end
return 0
`;

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const defaultToken = (): string => `${Date.now()}-${process.pid}-${(seq += 1)}`;

export function createConcurrencyLimiter(
  redis: RedisSemaphoreClient,
  opts: ConcurrencyOptions,
): ConcurrencyLimiter {
  const sleep = opts.sleep ?? defaultSleep;
  const token = opts.token ?? defaultToken;
  const pollMs = opts.pollMs ?? 50;

  return {
    async acquire() {
      const member = token();
      for (;;) {
        const granted = Number(await redis.eval(ACQUIRE, 1, opts.key, opts.limit, opts.leaseTtlMs, member));
        if (granted === 1) {
          let released = false;
          return {
            async release() {
              if (released) return;
              released = true;
              await redis.zrem(opts.key, member);
            },
          };
        }
        const jitter = Math.floor(Math.random() * 25);
        await sleep(pollMs + jitter);
      }
    },
  };
}
