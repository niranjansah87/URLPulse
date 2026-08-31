import postgres from "postgres";
import { config } from "./env";

export type Db = ReturnType<typeof postgres>;

/**
 * postgres.js client. Connections are established lazily on first query, so
 * constructing this does not require a reachable database (useful for tests
 * that only exercise routes not touching the DB).
 */
export function createDb(): Db {
  return postgres(config.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
  });
}
