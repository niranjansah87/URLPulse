import type { BatchStatus, UrlStatus } from "../types";

/** Visual tone → maps to a semantic color set in the StatusBadge/ProgressBar. */
export type Tone = "success" | "accent" | "warning" | "error" | "neutral";

export interface StatusView {
  label: string;
  tone: Tone;
}

const URL_STATUS: Record<UrlStatus, StatusView> = {
  SUCCESS: { label: "Completed", tone: "success" },
  PROCESSING: { label: "In Progress", tone: "accent" },
  PENDING: { label: "Queued", tone: "warning" },
  FAILED: { label: "Failed", tone: "error" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

const BATCH_STATUS: Record<BatchStatus, StatusView> = {
  PENDING: { label: "Pending", tone: "neutral" },
  PROCESSING: { label: "In Progress", tone: "accent" },
  COMPLETED: { label: "Completed", tone: "success" },
  FAILED: { label: "Failed", tone: "error" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function urlStatusView(status: UrlStatus): StatusView {
  return URL_STATUS[status];
}

export function batchStatusView(status: BatchStatus): StatusView {
  return BATCH_STATUS[status];
}

const HTTP_TEXT: Record<number, string> = {
  200: "200 OK",
  301: "301 Moved Permanently",
  404: "404 Not Found",
  429: "429 Too Many Requests",
  500: "500 Internal Server Error",
  503: "503 Service Unavailable",
};

/** Human-readable HTTP status; falls back to the bare code. */
export function httpStatusText(code: number | null): string {
  if (code === null) return "-";
  return HTTP_TEXT[code] ?? String(code);
}

/** Color tone for an HTTP status by class (2xx ok, 3xx info, 4xx warn, 5xx error). */
export function httpStatusTone(code: number | null): Tone {
  if (code === null) return "neutral";
  if (code >= 500) return "error";
  if (code >= 400) return "warning";
  if (code >= 300) return "accent";
  return "success";
}
