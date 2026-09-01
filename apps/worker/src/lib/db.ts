import postgres from "postgres";
import { config } from "./env";

export type Db = ReturnType<typeof postgres>;

/**
 * Shared postgres.js pool for the worker process (one per process, never per
 * job). Same configuration knobs and shared connection budget as the API pool
 * (@urlpulse/config): (API + worker processes) × DB_POOL_MAX must stay under
 * PostgreSQL max_connections. statement_timeout bounds any single query.
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
