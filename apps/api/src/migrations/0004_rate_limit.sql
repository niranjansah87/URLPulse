-- 0004_rate_limit: Better Auth database-backed rate limiting.
--
-- Backs `rateLimit: { storage: "database" }` in lib/auth.ts, so the auth rate
-- limits (including the tight password-reset caps) are shared across every API
-- instance instead of living in per-process memory. Column names are camelCase
-- (quoted) to match Better Auth's adapter, matching migrations 0002/0003.
-- Schema captured from getAuthTables(); forward-only, per the project's runner.

CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" integer NOT NULL,
  "lastRequest" bigint NOT NULL
);
