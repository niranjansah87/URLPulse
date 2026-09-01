import { Redis } from "ioredis";
import { config } from "./env";

/**
 * ioredis connection. `lazyConnect` defers the TCP connection until first use;
 * `maxRetriesPerRequest: null` is required by BullMQ for shared connections. An
 * `error` listener is attached so a connection failure surfaces as a handled log
 * line rather than crashing the process with an unhandled 'error' event.
 */
export function createRedis(): Redis {
  const redis = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  redis.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  return redis;
}

/**
 * Dedicated Redis connection for Pub/Sub subscription. A subscriber connection
 * cannot also issue ordinary commands, so it is kept separate from the
 * command/BullMQ connection (coding-conventions §8).
 */
export function createSubscriberRedis(): Redis {
  const redis = new Redis(config.REDIS_URL);
  redis.on("error", (err) => {
    console.error("[redis:sub] connection error:", err.message);
  });
  return redis;
}
