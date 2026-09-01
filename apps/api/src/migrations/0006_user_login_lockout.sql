-- 0006_user_login_lockout: wrong-password lockout state on the user row.
--
-- failedLoginCount tracks consecutive wrong-password sign-in attempts;
-- lockedUntil, when in the future, blocks sign-in (see lib/auth.ts hooks).
-- Server-only: these are read/written via raw SQL and are NOT Better Auth
-- additionalFields, so they never appear in any client-facing user payload.
-- camelCase (quoted) to match the auth schema. Forward-only, per the runner.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "failedLoginCount" integer NOT NULL DEFAULT 0;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "lockedUntil" timestamptz;
