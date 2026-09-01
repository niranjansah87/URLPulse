import type { BatchStatistics } from "../types";

/** Checked-or-in-flight count shown as batch progress (completed + inProgress + failed). */
export function progressCount(s: BatchStatistics): number {
  return s.completed + s.inProgress + s.failed;
}

export function progressPercent(s: BatchStatistics): number {
  if (s.total === 0) return 0;
  return Math.round((progressCount(s) / s.total) * 100);
}

/** Share of the total, as a fixed-1 percentage string. */
export function sharePercent(value: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}
