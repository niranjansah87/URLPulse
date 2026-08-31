-- 0001_init: core schema (see docs/03-backend/database.md)

CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  total_count integer NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  completed_count integer NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  cancelled_count integer NOT NULL DEFAULT 0 CHECK (cancelled_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_count + failed_count + cancelled_count <= total_count)
);

CREATE TABLE IF NOT EXISTS urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches (id) ON DELETE RESTRICT,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  http_status integer CHECK (http_status IS NULL OR (http_status BETWEEN 100 AND 599)),
  response_time_ms integer CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
  page_title text,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_urls_batch_id ON urls (batch_id);
CREATE INDEX IF NOT EXISTS idx_urls_batch_status ON urls (batch_id, status);
