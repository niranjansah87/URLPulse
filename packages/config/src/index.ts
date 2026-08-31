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

  // Outbound URL health-check bounds (worker). Every check is time-bounded,
  // redirect-bounded, and body-bounded so one URL cannot hang a worker or
  // exhaust memory (edge-cases §6/§38).
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  HTTP_MAX_REDIRECTS: z.coerce.number().int().nonnegative().default(5),
  HTTP_MAX_BODY_BYTES: z.coerce.number().int().positive().default(262_144),

  // Distributed concurrency lease TTL (ADR-022). MUST exceed the maximum time a
  // single check can hold a slot (HTTP_TIMEOUT_MS plus margin) so a live request
  // never loses its slot, while a crashed worker's slot is reclaimed on expiry.
  CONCURRENCY_LEASE_TTL_MS: z.coerce.number().int().positive().default(30_000),

  // A URL left PROCESSING longer than this (e.g. a worker crashed after claiming
  // but before persisting) is considered stuck and reclaimed to PENDING by the
  // reconciliation sweep. Must exceed the longest legitimate check (HTTP timeout
  // plus margin) so an in-flight request is never reclaimed.
  STUCK_PROCESSING_MS: z.coerce.number().int().positive().default(60_000),

  // How often the API runs the reconciliation sweep (re-enqueue PENDING work that
  // has no queue job, reclaim stuck PROCESSING URLs). Idempotent, so multiple API
  // instances running it concurrently is safe.
  RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),

  // SSRF: block loopback/private/link-local/metadata targets. Enable ONLY for
  // local development against localhost; MUST be false in production. Using a
  // string transform because z.coerce.boolean treats any non-empty string (incl.
  // "false") as true.
  HTTP_ALLOW_PRIVATE_HOSTS: z
    .string()
    .optional()
    .transform((v) => v === "true"),
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
