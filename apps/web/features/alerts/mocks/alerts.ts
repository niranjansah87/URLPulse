import type { Alert, AlertSeverity, AlertStatus } from "../types";

/**
 * FRONTEND MOCK ONLY — alerts have no backend yet. Deterministic seed: 47 alerts
 * = 3 critical + 12 warning + 8 info (unresolved) + 24 resolved, matching the
 * reference metric tiles. Replace with an API-backed store when alerts land.
 */

/** Fixed "now" so relative times in the mock are stable ("2m ago"). */
export const MOCK_NOW = "2025-08-30T10:27:00Z";

const at = (hhmm: string, dayOffset = 0) => {
  const d = new Date(`2025-08-30T${hhmm}:00Z`);
  d.setUTCDate(d.getUTCDate() - dayOffset);
  return d.toISOString();
};

const seeded: Alert[] = [
  { id: "al_001", title: "Server Error (5xx)", detail: "Received 500 Internal Server Error", batchId: "batch_22", batchName: "Customer Onboarding", url: "https://example.com", severity: "critical", status: "new", detectedAt: at("10:25") },
  { id: "al_002", title: "High Response Time", detail: "Response time is 2.45s", batchId: "batch_24", batchName: "Marketing Websites", url: "https://vercel.com", severity: "critical", status: "new", detectedAt: at("10:24") },
  { id: "al_003", title: "Slow Response", detail: "Response time is 1.85s", batchId: "batch_23", batchName: "Product Hunt Launch", url: "https://stripe.com", severity: "warning", status: "new", detectedAt: at("10:23") },
  { id: "al_004", title: "Redirect Detected", detail: "301 redirect to another URL", batchId: "batch_20", batchName: "Partner Sites", url: "https://old-site.com", severity: "warning", status: "acknowledged", detectedAt: at("10:20") },
  { id: "al_005", title: "SSL Certificate Expiring Soon", detail: "Expires in 15 days", batchId: "batch_19", batchName: "SEO Audit", url: "https://postgresql.org", severity: "info", status: "new", detectedAt: at("10:15") },
  { id: "al_006", title: "Page Title Changed", detail: "Page title has been updated", batchId: "batch_21", batchName: "Internal Tools Check", url: "https://github.com", severity: "info", status: "acknowledged", detectedAt: at("10:12") },
  { id: "al_007", title: "Server Recovered", detail: "Website is back to normal", batchId: "batch_22", batchName: "Customer Onboarding", url: "https://example.com", severity: "info", status: "resolved", detectedAt: at("10:10") },
  { id: "al_008", title: "High Response Time Resolved", detail: "Response time is back to normal", batchId: "batch_24", batchName: "Marketing Websites", url: "https://vercel.com", severity: "info", status: "resolved", detectedAt: at("10:05") },
];

interface Template {
  title: string;
  detail: string;
  severity: AlertSeverity;
}
const TEMPLATES: Record<AlertSeverity, Template[]> = {
  critical: [{ title: "Connection Refused", detail: "Host refused the connection", severity: "critical" }],
  warning: [
    { title: "Slow Response", detail: "Response time is above 1.5s", severity: "warning" },
    { title: "Redirect Detected", detail: "Permanent redirect to another URL", severity: "warning" },
  ],
  info: [
    { title: "Page Title Changed", detail: "Page title has been updated", severity: "info" },
    { title: "SSL Certificate Expiring Soon", detail: "Expires within 30 days", severity: "info" },
  ],
};
const BATCHES = [
  ["batch_24", "Marketing Websites", "https://linear.app"],
  ["batch_23", "Product Hunt Launch", "https://notion.so"],
  ["batch_21", "Internal Tools Check", "https://tailwindcss.com"],
  ["batch_19", "SEO Audit", "https://redis.io"],
  ["batch_20", "Partner Sites", "https://cloudflare.com"],
] as const;

function fill(count: number, severity: AlertSeverity, status: AlertStatus, startIndex: number, startMinute: number): Alert[] {
  const out: Alert[] = [];
  for (let i = 0; i < count; i++) {
    const t = TEMPLATES[severity][i % TEMPLATES[severity].length]!;
    const b = BATCHES[(startIndex + i) % BATCHES.length]!;
    const minute = startMinute - i * 7;
    const day = Math.floor(Math.max(0, -minute) / (24 * 60)) + (minute < 0 ? 1 : 0);
    const mm = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
    const hhmm = `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
    out.push({
      id: `al_${String(startIndex + i + 1).padStart(3, "0")}`,
      title: status === "resolved" ? `${t.title} Resolved` : t.title,
      detail: status === "resolved" ? "Back to normal" : t.detail,
      batchId: b[0],
      batchName: b[1],
      url: b[2],
      severity,
      status,
      detectedAt: at(hhmm, day),
    });
  }
  return out;
}

export const MOCK_ALERTS: Alert[] = [
  ...seeded,
  ...fill(1, "critical", "new", 8, 9 * 60 + 50),
  ...fill(10, "warning", "new", 9, 9 * 60 + 40),
  ...fill(6, "info", "acknowledged", 19, 8 * 60 + 30),
  ...fill(22, "info", "resolved", 25, 7 * 60 + 45),
];

/** Unread = alerts still in the "new" state. */
export const UNREAD_ALERT_COUNT = MOCK_ALERTS.filter((a) => a.status === "new").length;
