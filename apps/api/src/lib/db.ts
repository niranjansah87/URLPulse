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
 * - prepare: false      required behind pgbouncer transaction pooling, which
 *                       reuses server connections across clients and so cannot
 *                       carry named prepared statements or connection-time
 *                       startup params. statement_timeout is enforced as a
 *                       database default instead (ALTER DATABASE ... SET
 *                       statement_timeout) - see docs/03-backend/database.md.
 */
export function createDb(): Db {
  return postgres(config.DATABASE_URL, {
    max: config.DB_POOL_MAX,
    connect_timeout: config.DB_CONNECT_TIMEOUT_SECONDS,
    idle_timeout: config.DB_IDLE_TIMEOUT_SECONDS,
    prepare: false,
    onnotice: () => {},
  });
}
