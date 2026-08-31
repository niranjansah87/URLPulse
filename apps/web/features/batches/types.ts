/**
 * Frontend view model for batches. Shared enums/DTOs come from @urlpulse/types
 * (the real API contract); this file adds the view-layer shapes the UI renders.
 * `lib/view.ts` maps API DTOs → these types so components never touch transport.
 */
import type { BatchStatus, BatchSummary, UrlStatus, UrlResult } from "@urlpulse/types";

export type { BatchStatus, UrlStatus, UrlResult, BatchSummary };

export interface BatchStatistics {
  total: number;
  completed: number;
  inProgress: number;
  queued: number;
  failed: number;
  cancelled: number;
}

/** Per-batch settings. The backend applies system-wide values today; null = not configurable yet. */
export interface BatchConfig {
  checkIntervalMinutes: number | null;
  timeoutSeconds: number | null;
  retryAttempts: number | null;
}

export interface Batch {
  id: string;
  /** Display name. The API has no name field yet; derived from the id. */
  name: string;
  status: BatchStatus;
  statistics: BatchStatistics;
  config: BatchConfig;
  createdBy: string | null;
  createdAt: string; // ISO
  startedAt: string | null; // ISO
  updatedAt: string; // ISO
}

export type ActivityKind = "checked" | "checking" | "failed";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  url: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  message: string | null;
  at: string | null; // ISO when known
}

export interface BatchDetailData {
  batch: Batch;
  urls: UrlResult[];
  activity: ActivityEvent[];
}

/** Row shape for list/history tables, derived from BatchSummary. */
export interface BatchRow {
  id: string;
  name: string;
  status: BatchStatus;
  total: number;
  done: number; // completed + failed + cancelled
  completed: number;
  failed: number;
  progressPercent: number;
  createdAt: string;
}
