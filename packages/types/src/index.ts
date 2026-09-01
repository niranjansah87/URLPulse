import { z } from "zod";

/**
 * Shared domain and API types for URLPulse.
 *
 * zod schemas are the single source of truth; TypeScript types are inferred
 * from them so runtime validation and compile-time types cannot drift.
 * See docs/03-backend/database.md and docs/03-backend/api.md.
 */

// --- Domain status enums (see job-lifecycle.md) ---

export const batchStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type BatchStatus = z.infer<typeof batchStatusSchema>;

export const urlStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
]);
export type UrlStatus = z.infer<typeof urlStatusSchema>;

// --- Result / DTO shapes (see api.md) ---

export const urlResultSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  status: urlStatusSchema,
  httpStatus: z.number().int().nullable(),
  responseTimeMs: z.number().int().nullable(),
  pageTitle: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type UrlResult = z.infer<typeof urlResultSchema>;

export const batchSummarySchema = z.object({
  id: z.string().uuid(),
  status: batchStatusSchema,
  totalCount: z.number().int(),
  completedCount: z.number().int(),
  failedCount: z.number().int(),
  cancelledCount: z.number().int(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type BatchSummary = z.infer<typeof batchSummarySchema>;

export const batchDetailSchema = batchSummarySchema.extend({
  urls: z.array(urlResultSchema),
});
export type BatchDetail = z.infer<typeof batchDetailSchema>;

// --- Request shapes ---

/**
 * A single submittable URL. Whitespace is trimmed (normalization, edge-cases §2)
 * and the scheme is constrained to http/https (api.md validation; ftp/other are
 * rejected). JSON and CSV inputs both validate through this schema so the two
 * paths cannot diverge.
 */
/** Resource bounds (INV-12): a batch cannot be unbounded in count or URL length. */
export const MAX_URLS_PER_BATCH = 10_000;
export const MAX_URL_LENGTH = 2_048;

export const httpUrlSchema = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH, `URL exceeds ${MAX_URL_LENGTH} characters`)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "URL must use http or https",
  });

export const createBatchRequestSchema = z.object({
  urls: z
    .array(httpUrlSchema)
    .min(1, "at least one URL is required")
    .max(MAX_URLS_PER_BATCH, `a batch may contain at most ${MAX_URLS_PER_BATCH} URLs`),
});
export type CreateBatchRequest = z.infer<typeof createBatchRequestSchema>;

// --- List query + pagination (api.md §8) ---

export const listBatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;

export interface BatchListMeta {
  page: number;
  pageSize: number;
  total: number;
}

// --- Alerts (conditions detected during a URL check) ---

export const alertSeveritySchema = z.enum(["critical", "warning", "info"]);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

export const alertStatusSchema = z.enum(["new", "acknowledged", "resolved"]);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

/** What was detected. Drives the title/severity the worker records. */
export const alertTypeSchema = z.enum([
  "SERVER_ERROR", // 5xx response
  "UNREACHABLE", // timeout, connection/DNS error, blocked target
  "CLIENT_ERROR", // 4xx response
  "SLOW_RESPONSE", // response time over threshold
  "REDIRECT", // resolved via one or more redirects
  "SSL_EXPIRING", // TLS certificate expiring soon
  "TITLE_CHANGED", // page <title> differs from the previous check
  "RECOVERED", // a URL with an open failure alert now succeeds
]);
export type AlertType = z.infer<typeof alertTypeSchema>;

export const alertSchema = z.object({
  id: z.string().uuid(),
  type: alertTypeSchema,
  title: z.string(),
  detail: z.string(),
  batchId: z.string().uuid(),
  url: z.string(),
  severity: alertSeveritySchema,
  status: alertStatusSchema,
  detectedAt: z.string(),
});
export type Alert = z.infer<typeof alertSchema>;

export const listAlertsQuerySchema = z.object({
  status: alertStatusSchema.optional(),
  severity: alertSeveritySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;

/** Counts used by the alerts dashboard tiles and the unread bell badge. */
export const alertCountsSchema = z.object({
  critical: z.number().int(),
  warning: z.number().int(),
  info: z.number().int(),
  resolved: z.number().int(),
  unread: z.number().int(),
  total: z.number().int(),
});
export type AlertCounts = z.infer<typeof alertCountsSchema>;

// --- Canonical error codes (api.md §5/§17) ---

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "NOT_IMPLEMENTED",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// --- API response envelopes (see api.md sections 4-5) ---

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

// --- Live updates (see live-updates.md) ---

export const sseBatchUpdatedSchema = z.object({
  batchId: z.string().uuid(),
  version: z.number().int(),
});
export type SseBatchUpdated = z.infer<typeof sseBatchUpdatedSchema>;

export const SSE_EVENT_BATCH_UPDATED = "batch.updated" as const;

/** Redis Pub/Sub channel carrying batch.updated notifications across instances. */
export const BATCH_EVENTS_CHANNEL = "events:batch-updated" as const;

/**
 * Redis key holding the batch-list cache version counter (ADR-012). Bumping it
 * (INCR) invalidates every cached page at once. Shared here as a contract because
 * BOTH the API (which reads/writes the cache) and the worker (which invalidates
 * it when a batch changes state) must agree on the exact key.
 */
export const BATCH_LIST_CACHE_VERSION_KEY = "cache:batches:list:ver" as const;

/**
 * Serialize a batch.updated notification. `version` is a monotonic-ish publish
 * timestamp used only to drop obviously out-of-order events on the client;
 * correctness comes from refetching authoritative state (ADR-005).
 */
export function buildBatchUpdatedMessage(batchId: string): string {
  const payload: SseBatchUpdated = { batchId, version: Date.now() };
  return JSON.stringify(payload);
}

// --- Queue contract shared by API (producer) and worker (consumer) ---

export const URL_CHECK_QUEUE = "url-check" as const;

export const urlCheckJobDataSchema = z.object({
  batchId: z.string().uuid(),
  urlId: z.string().uuid(),
});
export type UrlCheckJobData = z.infer<typeof urlCheckJobDataSchema>;
