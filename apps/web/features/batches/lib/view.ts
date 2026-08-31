import type { BatchDetail, BatchSummary, UrlResult } from "@urlpulse/types";
import type { ActivityEvent, Batch, BatchDetailData, BatchRow, BatchStatistics } from "../types";

/** Documented system-wide check settings (docs/03-backend); not per-batch yet. */
const SYSTEM_TIMEOUT_SECONDS = 10;
const SYSTEM_RETRY_ATTEMPTS = 3;

/** The API has no batch name; a short, stable label from the id keeps rows scannable. */
export function batchDisplayName(id: string): string {
  return `Batch ${id.slice(0, 8)}`;
}

export function toBatchRow(s: BatchSummary): BatchRow {
  const done = s.completedCount + s.failedCount + s.cancelledCount;
  return {
    id: s.id,
    name: batchDisplayName(s.id),
    status: s.status,
    total: s.totalCount,
    done,
    completed: s.completedCount,
    failed: s.failedCount,
    progressPercent: s.totalCount === 0 ? 0 : Math.round((done / s.totalCount) * 100),
    createdAt: s.createdAt,
  };
}

function statisticsFrom(d: BatchDetail): BatchStatistics {
  const inProgress = d.urls.filter((u) => u.status === "PROCESSING").length;
  const queued = d.urls.filter((u) => u.status === "PENDING").length;
  return {
    total: d.totalCount,
    completed: d.completedCount,
    failed: d.failedCount,
    cancelled: d.cancelledCount,
    inProgress,
    queued,
  };
}

/**
 * Activity is projected from URL results until the backend exposes an event
 * log: terminal rows become "checked"/"failed", processing rows "checking".
 */
function activityFrom(urls: UrlResult[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const u of urls) {
    if (u.status === "SUCCESS") {
      events.push({ id: u.id, kind: "checked", url: u.url, httpStatus: u.httpStatus, responseTimeMs: u.responseTimeMs, message: null, at: null });
    } else if (u.status === "FAILED") {
      events.push({ id: u.id, kind: "failed", url: u.url, httpStatus: u.httpStatus, responseTimeMs: null, message: u.error, at: null });
    } else if (u.status === "PROCESSING") {
      events.push({ id: u.id, kind: "checking", url: u.url, httpStatus: null, responseTimeMs: null, message: null, at: null });
    }
    if (events.length >= 5) break;
  }
  return events;
}

export function toBatchDetailData(d: BatchDetail, fetchedAt: string = new Date().toISOString()): BatchDetailData {
  const batch: Batch = {
    id: d.id,
    name: batchDisplayName(d.id),
    status: d.status,
    statistics: statisticsFrom(d),
    config: { checkIntervalMinutes: null, timeoutSeconds: SYSTEM_TIMEOUT_SECONDS, retryAttempts: SYSTEM_RETRY_ATTEMPTS },
    createdBy: null,
    createdAt: d.createdAt,
    startedAt: d.status === "PENDING" ? null : d.createdAt,
    updatedAt: fetchedAt,
  };
  return { batch, urls: d.urls, activity: activityFrom(d.urls) };
}
