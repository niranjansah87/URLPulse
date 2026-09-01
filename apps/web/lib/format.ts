/** Presentation-only formatting helpers. Pure, deterministic, timezone-safe for UTC input. */

/** Response time: seconds for >= 1s (e.g. "1.42 s"), milliseconds otherwise. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms} ms`;
}

/** Full timestamp, e.g. "Aug 30, 2025 10:24 AM". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Coarse relative time, e.g. "2 minutes ago". Non-live; recompute on render. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return sec <= 1 ? "just now" : `${sec} seconds ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? "1 day ago" : `${day} days ago`;
}

/** Truncate the middle of a long id/string, keeping head and tail. */
export function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
