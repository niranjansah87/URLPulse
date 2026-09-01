import postgres from "postgres";
import { config } from "./env";

export type Db = ReturnType<typeof postgres>;

/**
 * Shared postgres.js connection pool for the API process. One pool per process
 * (never a connection per request); postgres.js opens connections lazily up to
 * `max` and reaps idle ones. Sizing is a shared budget across API + worker
 * processes - see DB_POOL_MAX in @urlpulse/config.
 *
 * - max                 pool ceiling for this process
 * - connect_timeout     fail fast instead of hanging when PG is unreachable
 * - idle_timeout        release idle connections back to PG
 * - statement_timeout   server-side cap on any single query so a slow/stuck
 *                       query cannot pin a pooled connection forever
 */
export function createDb(): Db {
  return postgres(config.DATABASE_URL, {
    max: config.DB_POOL_MAX,
    connect_timeout: config.DB_CONNECT_TIMEOUT_SECONDS,
    idle_timeout: config.DB_IDLE_TIMEOUT_SECONDS,
    connection: {
      statement_timeout: config.DB_STATEMENT_TIMEOUT_MS,
    },
    onnotice: () => {},
  });
}
