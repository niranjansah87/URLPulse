-- 0003_batches_user_id: associate every batch with the Better Auth user that owns it.
--
-- Ownership is derived from the authenticated session server-side and written here;
-- it is never accepted from the client. All batch reads and mutations filter on
-- user_id so one user can never see or change another user's batches.
--
-- Nullable by design: any batch rows created before auth existed have no owner and
-- therefore match no user (queries filter user_id = <session user>), so they are
-- invisible rather than leaking. The application always sets user_id on new batches.
-- Forward-only, matching the project's migration runner (0001/0002).

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS user_id text REFERENCES "user" ("id") ON DELETE CASCADE;

-- Supports the user-scoped batch list: WHERE user_id = $1 ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_batches_user_created ON batches (user_id, created_at DESC);
