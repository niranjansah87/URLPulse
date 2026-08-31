import { z } from "zod";

/**
 * Server-only configuration for URLPulse.
 *
 * SECURITY: This package reads secrets (DATABASE_URL, REDIS_URL). It must only
 * be imported by server processes (api, worker) — never by the Next.js browser
 * bundle. Browser-safe values belong in NEXT_PUBLIC_* variables read by the web
 * app directly. See docs/05-infrastructure/local-development.md.
 */

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  RATE_LIMIT_RPS: z.coerce.number().int().positive().default(10),
  MAX_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  BATCH_LIST_CACHE_SECONDS: z.coerce.number().int().nonnegative().default(30),

  // PostgreSQL pooling. Pool sizing is a shared budget, not a per-process free
  // choice: total connections ≈ (API instances × DB_POOL_MAX) +
  // (worker processes × DB_POOL_MAX) and must stay under PostgreSQL
  // max_connections (default 100). The defaults suit local dev (1 API + 1
  // worker). statement_timeout bounds any single query so a slow query cannot
  // pin a pooled connection indefinitely.
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  DB_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(20),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type ServerConfig = z.infer<typeof serverEnvSchema>;

/**
 * Parse and validate server configuration from an env source (defaults to
 * process.env). Throws a single readable error listing every invalid or
 * missing variable, so a misconfigured process fails fast at startup.
 */
export function loadServerConfig(source: Record<string, string | undefined> = process.env): ServerConfig {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid URLPulse server configuration:\n${issues}`);
  }
  return result.data;
}
