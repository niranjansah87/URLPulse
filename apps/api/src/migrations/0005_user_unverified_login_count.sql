-- 0005_user_unverified_login_count: back the email-verification grace period.
--
-- Counts how many times an unverified user has signed in. The session.create.before
-- hook increments it on each unverified sign-in and blocks further sign-ins once it
-- exceeds MAX_UNVERIFIED_LOGINS, until the user verifies. camelCase (quoted) to
-- match Better Auth's adapter and the additionalFields declaration in lib/auth.ts.
-- Forward-only, per the project's runner.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "unverifiedLoginCount" integer NOT NULL DEFAULT 0;
