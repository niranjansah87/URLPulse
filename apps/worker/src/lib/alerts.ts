import type { AlertSeverity, AlertType } from "@urlpulse/types";
import type { UrlCheckResult } from "./http-checker";

/**
 * Alert derivation (pure). Given a terminal check result and the small amount of
 * prior state the worker can see in-transaction, decide which alerts a URL
 * raises. No I/O here so the rules are unit-testable; the repository performs the
 * idempotent inserts and the resolve-on-recovery.
 */

export interface NewAlert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

export interface AlertContext {
  /** page_title from the previous check of this URL, if any. */
  previousTitle: string | null;
  /** Whether this URL already has an open (unresolved) failure alert. */
  hadOpenFailure: boolean;
  /** Response time (ms) above which a SUCCESS raises SLOW_RESPONSE. */
  slowThresholdMs: number;
  /** Raise SSL_EXPIRING when the cert expires within this many days. */
  sslWarnDays: number;
  /** Injected clock for deterministic tests. */
  now: Date;
}

export interface AlertDerivation {
  inserts: NewAlert[];
  /** On a successful check, open failure alerts for this URL are resolved. */
  resolveOpenFailures: boolean;
}

/** Failure alert types that a later SUCCESS clears (drives RECOVERED). */
export const FAILURE_ALERT_TYPES: AlertType[] = ["SERVER_ERROR", "UNREACHABLE", "CLIENT_ERROR"];

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveAlerts(result: UrlCheckResult, ctx: AlertContext): AlertDerivation {
  const inserts: NewAlert[] = [];

  if (result.status === "FAILED") {
    inserts.push(failureAlert(result));
    return { inserts, resolveOpenFailures: false };
  }

  // SUCCESS.
  if (ctx.hadOpenFailure) {
    inserts.push({ type: "RECOVERED", severity: "info", title: "Recovered", detail: "Back to normal" });
  }
  if (result.responseTimeMs !== null && result.responseTimeMs > ctx.slowThresholdMs) {
    inserts.push({
      type: "SLOW_RESPONSE",
      severity: "warning",
      title: "Slow Response",
      detail: `Response time is ${(result.responseTimeMs / 1000).toFixed(2)}s`,
    });
  }
  if (result.redirected) {
    inserts.push({ type: "REDIRECT", severity: "warning", title: "Redirect Detected", detail: "Resolved via a redirect" });
  }
  if (result.certExpiresAt) {
    const days = Math.floor((new Date(result.certExpiresAt).getTime() - ctx.now.getTime()) / DAY_MS);
    if (days <= ctx.sslWarnDays) {
      inserts.push({
        type: "SSL_EXPIRING",
        severity: "info",
        title: "SSL Certificate Expiring Soon",
        detail: days < 0 ? "Certificate has expired" : `Expires in ${days} day${days === 1 ? "" : "s"}`,
      });
    }
  }
  if (ctx.previousTitle !== null && result.pageTitle !== null && ctx.previousTitle !== result.pageTitle) {
    inserts.push({ type: "TITLE_CHANGED", severity: "info", title: "Page Title Changed", detail: "Page title has been updated" });
  }

  return { inserts, resolveOpenFailures: true };
}

function failureAlert(result: UrlCheckResult): NewAlert {
  const status = result.httpStatus;
  if (status !== null && status >= 500) {
    return { type: "SERVER_ERROR", severity: "critical", title: "Server Error (5xx)", detail: `Received HTTP ${status}` };
  }
  if (status !== null && status >= 400) {
    return { type: "CLIENT_ERROR", severity: "warning", title: "Client Error (4xx)", detail: `Received HTTP ${status}` };
  }
  return {
    type: "UNREACHABLE",
    severity: "critical",
    title: "Unreachable",
    detail: result.errorMessage ?? "The URL could not be reached",
  };
}
