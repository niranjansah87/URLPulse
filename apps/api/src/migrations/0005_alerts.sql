-- 0005_alerts: conditions detected during a URL check (server errors, slow
-- responses, redirects, SSL expiry, title changes, recovery).
--
-- Alerts are DERIVED from url checks, never authoritative health state — the
-- urls/batches tables remain the source of truth. The worker writes alerts in
-- the SAME transaction that persists a URL result, so generation is atomic with
-- the (idempotent) result write: a duplicate/stale job that does not apply the
-- result also generates no alert.
--
-- user_id is denormalized from the owning batch so the API can list a user's
-- alerts without a join and enforce ownership the same way batches do. Nullable
-- to match batches.user_id (legacy/ownerless rows match no session and stay
-- invisible). Forward-only, matching the project's migration runner.

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES "user" ("id") ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches (id) ON DELETE CASCADE,
  url_id uuid NOT NULL REFERENCES urls (id) ON DELETE CASCADE,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'SERVER_ERROR', 'UNREACHABLE', 'CLIENT_ERROR', 'SLOW_RESPONSE',
    'REDIRECT', 'SSL_EXPIRING', 'TITLE_CHANGED', 'RECOVERED'
  )),
  title text NOT NULL,
  detail text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency + de-duplication: at most one OPEN (non-resolved) alert of a given
-- type per URL. The worker inserts with ON CONFLICT DO NOTHING, so re-checking a
-- URL that still has the same condition does not pile up duplicate alerts; once
-- an alert is resolved a fresh occurrence can raise a new one.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_alerts_open_url_type
  ON alerts (url_id, type)
  WHERE status <> 'resolved';

-- Supports the user-scoped list: WHERE user_id = $1 [AND status/severity] ORDER BY detected_at DESC.
CREATE INDEX IF NOT EXISTS idx_alerts_user_detected ON alerts (user_id, detected_at DESC);
-- Supports recovered detection and resolve-on-success: open alerts for a URL.
CREATE INDEX IF NOT EXISTS idx_alerts_url_status ON alerts (url_id, status);
