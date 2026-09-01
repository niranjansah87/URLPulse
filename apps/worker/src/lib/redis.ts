import { Redis } from "ioredis";
import { config } from "./env";

/**
 * ioredis connection for BullMQ. `maxRetriesPerRequest: null` is required by
 * BullMQ. An `error` listener is attached so a connection failure surfaces as a
 * handled log line rather than crashing the worker with an unhandled 'error'
 * event; BullMQ handles its own reconnection.
 */
export function createRedis(): Redis {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  redis.on("error", (err) => {
    console.error("[worker][redis] connection error:", err.message);
  });
  return redis;
}

/**
 * Ordinary-command Redis connection for coordination primitives (rate limiter,
 * concurrency lease). Kept separate from the BullMQ connection so their
 * behaviors and lifecycles do not interfere (coding-conventions §8).
 */
export function createCommandRedis(): Redis {
  const redis = new Redis(config.REDIS_URL);
  redis.on("error", (err) => {
    console.error("[worker][redis:cmd] connection error:", err.message);
  });
  return redis;
}
