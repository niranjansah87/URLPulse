import type { Tone } from "@/features/batches/lib/status";
import type { Alert, AlertSeverity, AlertStatus } from "../types";

export const SEVERITY_VIEW: Record<AlertSeverity, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "error" },
  warning: { label: "Warning", tone: "warning" },
  info: { label: "Info", tone: "accent" },
};

export const STATUS_VIEW: Record<AlertStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "error" },
  acknowledged: { label: "Acknowledged", tone: "accent" },
  resolved: { label: "Resolved", tone: "success" },
};

export interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
  resolved: number;
  total: number;
}

/** Unresolved counts per severity + resolved, as shown on the metric tiles. */
export function countAlerts(alerts: Alert[]): AlertCounts {
  const c = { critical: 0, warning: 0, info: 0, resolved: 0, total: alerts.length };
  for (const a of alerts) {
    if (a.status === "resolved") c.resolved++;
    else c[a.severity]++;
  }
  return c;
}

export function formatDatePart(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function formatTimePart(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
