export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "new" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  title: string;
  detail: string;
  batchId: string;
  batchName: string;
  url: string;
  severity: AlertSeverity;
  status: AlertStatus;
  detectedAt: string; // ISO
}
