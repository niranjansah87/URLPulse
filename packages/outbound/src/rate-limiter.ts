/**
 * Global outbound rate limiter (INV-4). A Redis sliding-window log shared by
 * every worker process: admission is decided by one atomic Lua script, so N
 * workers together never exceed `limit` requests per `windowMs`. This is NOT a
 * process-local counter.
 *
 * The window uses Redis server time (`TIME`) inside the script, not the worker's
 * clock, so workers on different machines agree (rate-limiting.md §17).
 *
 * Redis failure policy (ADR-020): if the script cannot run, admission throws;
 * the caller must NOT fall back to unlimited local requests.
 */
export interface RedisEval {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  key: string;
  /** Overridable for tests; defaults to real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Overridable for tests; defaults to Math.random-based token. */
  token?: () => string;
  /** Upper bound on a single sleep between polls (ms). */
  maxSleepMs?: number;
}

export interface RateLimiter {
  /** Resolve once a global permit is granted; blocks (with backoff) otherwise. */
  acquire(): Promise<void>;
}

// -1 => admitted; otherwise the ms to wait before the next attempt.
const SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local member = ARGV[3]
local t = redis.call('TIME')
local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return -1
end
local earliest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local wait = (tonumber(earliest[2]) + window) - now
if wait < 0 then wait = 0 end
return wait
`;

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const defaultToken = (): string => `${Date.now()}-${process.pid}-${(seq += 1)}`;

export function createRateLimiter(redis: RedisEval, opts: RateLimiterOptions): RateLimiter {
  const sleep = opts.sleep ?? defaultSleep;
  const token = opts.token ?? defaultToken;
  const maxSleepMs = opts.maxSleepMs ?? opts.windowMs;

  return {
    async acquire() {
      for (;;) {
        const result = await redis.eval(SCRIPT, 1, opts.key, opts.limit, opts.windowMs, token());
        const wait = Number(result);
        if (wait < 0) return;
        // Small jitter avoids a thundering herd of workers waking together.
        const jitter = Math.floor(Math.random() * 25);
        await sleep(Math.min(wait, maxSleepMs) + jitter);
      }
    },
  };
}
