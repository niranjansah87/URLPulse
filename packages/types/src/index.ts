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
export const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "URL must use http or https",
  });

export const createBatchRequestSchema = z.object({
  urls: z.array(httpUrlSchema).min(1, "at least one URL is required"),
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

// --- Canonical error codes (api.md §5/§17) ---

export const ERROR_CODES = [
  "VALIDATION_ERROR",
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

// --- Queue contract shared by API (producer) and worker (consumer) ---

export const URL_CHECK_QUEUE = "url-check" as const;

export const urlCheckJobDataSchema = z.object({
  batchId: z.string().uuid(),
  urlId: z.string().uuid(),
});
export type UrlCheckJobData = z.infer<typeof urlCheckJobDataSchema>;
