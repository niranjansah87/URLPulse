import type { BatchRow, BatchStatus } from "@/features/batches/types";
import type { Tone } from "@/features/batches/lib/status";

/**
 * Pure helpers for the History view. Filtering/sorting run client-side over the
 * fetched page - the list API only supports page/pageSize today. When it grows
 * server-side filters, move these params into `batchesApi.list`.
 */

export type DatePreset = "7" | "30" | "90" | "all";
export type StatusFilter = "all" | BatchStatus;

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PROCESSING", label: "In Progress" },
  { value: "PENDING", label: "Queued" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export interface HistoryFilters {
  date: DatePreset;
  status: StatusFilter;
  query: string;
  sort: "asc" | "desc";
}

export const DEFAULT_FILTERS: HistoryFilters = { date: "all", status: "all", query: "", sort: "desc" };

const DAY_MS = 86_400_000;

export function applyFilters(rows: BatchRow[], f: HistoryFilters, now = Date.now()): BatchRow[] {
  const cutoff = f.date === "all" ? -Infinity : now - Number(f.date) * DAY_MS;
  const q = f.query.trim().toLowerCase();
  const out = rows.filter(
    (r) =>
      new Date(r.createdAt).getTime() >= cutoff &&
      (f.status === "all" || r.status === f.status) &&
      (q === "" || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)),
  );
  return out.sort((a, b) => {
    const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return f.sort === "asc" ? d : -d;
  });
}

export interface HistoryStats {
  total: number;
  completed: number;
  inProgress: number;
  queued: number;
  failed: number;
  cancelled: number;
}

export function computeStats(rows: BatchRow[]): HistoryStats {
  const s: HistoryStats = { total: rows.length, completed: 0, inProgress: 0, queued: 0, failed: 0, cancelled: 0 };
  for (const r of rows) {
    if (r.status === "COMPLETED") s.completed++;
    else if (r.status === "PROCESSING") s.inProgress++;
    else if (r.status === "PENDING") s.queued++;
    else if (r.status === "FAILED") s.failed++;
    else if (r.status === "CANCELLED") s.cancelled++;
  }
  return s;
}

/** Batches per day over the last `days` days (oldest → newest) - a real trend for the sparklines. */
export function dailySeries(rows: BatchRow[], pick: (r: BatchRow) => boolean, days = 7, now = Date.now()): number[] {
  const series = new Array<number>(days).fill(0);
  const start = now - (days - 1) * DAY_MS;
  for (const r of rows) {
    if (!pick(r)) continue;
    const idx = Math.floor((new Date(r.createdAt).getTime() - start) / DAY_MS);
    if (idx >= 0 && idx < days) series[idx]!++;
  }
  return series;
}

export function percentOf(part: number, whole: number): string {
  return whole === 0 ? "0.0%" : `${((part / whole) * 100).toFixed(1)}%`;
}

export interface ActivityItem {
  id: string;
  title: string;
  name: string;
  tone: Tone;
  at: string;
}

const ACTIVITY: Record<BatchStatus, { title: string; tone: Tone }> = {
  COMPLETED: { title: "Batch completed", tone: "success" },
  FAILED: { title: "Batch failed", tone: "error" },
  PROCESSING: { title: "Batch started", tone: "accent" },
  PENDING: { title: "Batch queued", tone: "warning" },
  CANCELLED: { title: "Batch cancelled", tone: "neutral" },
};

/** Recent activity projected from batch status + creation time (no event log in the API yet). */
export function recentActivity(rows: BatchRow[], limit = 5): ActivityItem[] {
  return [...rows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((r) => ({ id: r.id, name: r.name, at: r.createdAt, ...ACTIVITY[r.status] }));
}
