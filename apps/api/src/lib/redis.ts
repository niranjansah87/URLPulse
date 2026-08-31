import { Redis } from "ioredis";
import { config } from "./env";

/**
 * ioredis connection. `lazyConnect` defers the TCP connection until first use.
 * `maxRetriesPerRequest: null` is required by BullMQ for shared connections.
 */
export function createRedis(): Redis {
  return new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}
