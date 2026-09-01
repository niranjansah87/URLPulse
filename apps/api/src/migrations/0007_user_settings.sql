-- 0007_user_settings: per-user monitoring configuration.
--
-- One row per user holding the check-defining defaults surfaced in Settings →
-- Monitoring (and the "Default Monitoring Settings" card in General). PostgreSQL
-- is authoritative; the UI reconstructs settings from here on any device. Purely
-- cosmetic UI preferences (timezone, language, dashboard toggles) are NOT stored
-- here — they stay device-local in the browser.
--
-- user_id is the primary key (at most one settings row per user) and cascades on
-- user deletion. Columns carry defaults matching @urlpulse/types
-- DEFAULT_USER_SETTINGS, so a user with no row yet reads coherent defaults.
-- Forward-only, matching the project's migration runner.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  check_interval_minutes int NOT NULL DEFAULT 5,
  timeout_seconds int NOT NULL DEFAULT 10,
  retry_attempts int NOT NULL DEFAULT 2,
  user_agent text NOT NULL DEFAULT 'URLPulse Bot',
  status_codes_down text NOT NULL DEFAULT '400, 401, 403, 404, 429, 500, 502, 503, 504',
  follow_redirects boolean NOT NULL DEFAULT true,
  ssl_validation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
