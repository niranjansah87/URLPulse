import { Redis } from "ioredis";
import { config } from "./env";

/** ioredis connection for BullMQ. `maxRetriesPerRequest: null` is required by BullMQ. */
export function createRedis(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}
