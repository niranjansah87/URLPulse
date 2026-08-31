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
