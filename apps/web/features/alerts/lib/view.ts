import type { Tone } from "@/features/batches/lib/status";
import type { AlertSeverity, AlertStatus } from "../types";

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

export function formatDatePart(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function formatTimePart(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
