import { describe, it, expect } from "vitest";
import { deriveAlerts, type AlertContext } from "./alerts";
import type { UrlCheckResult } from "./http-checker";

const NOW = new Date("2025-08-30T10:00:00Z");

const ctx = (over: Partial<AlertContext> = {}): AlertContext => ({
  previousTitle: null,
  hadOpenFailure: false,
  slowThresholdMs: 1500,
  sslWarnDays: 30,
  now: NOW,
  ...over,
});

const ok = (over: Partial<UrlCheckResult> = {}): UrlCheckResult => ({
  status: "SUCCESS",
  httpStatus: 200,
  responseTimeMs: 100,
  pageTitle: "Home",
  errorCode: null,
  errorMessage: null,
  retryable: false,
  redirected: false,
  certExpiresAt: null,
  ...over,
});

const failed = (over: Partial<UrlCheckResult>): UrlCheckResult => ok({ status: "FAILED", pageTitle: null, ...over });

const types = (r: UrlCheckResult, c: AlertContext = ctx()) => deriveAlerts(r, c).inserts.map((a) => a.type);

describe("deriveAlerts", () => {
  it("raises SERVER_ERROR (critical) for a 5xx", () => {
    expect(deriveAlerts(failed({ httpStatus: 503 }), ctx()).inserts).toEqual([
      { type: "SERVER_ERROR", severity: "critical", title: "Server Error (5xx)", detail: "Received HTTP 503" },
    ]);
  });

  it("raises CLIENT_ERROR (warning) for a 4xx", () => {
    expect(types(failed({ httpStatus: 404 }))).toEqual(["CLIENT_ERROR"]);
  });

  it("raises UNREACHABLE for a network failure with no status", () => {
    expect(types(failed({ httpStatus: null, errorCode: "TIMEOUT", errorMessage: "Request timed out" }))).toEqual(["UNREACHABLE"]);
  });

  it("does not resolve open failures on a failed check", () => {
    expect(deriveAlerts(failed({ httpStatus: 500 }), ctx()).resolveOpenFailures).toBe(false);
  });

  it("raises SLOW_RESPONSE when over the threshold", () => {
    expect(types(ok({ responseTimeMs: 2000 }))).toContain("SLOW_RESPONSE");
  });

  it("does not raise SLOW_RESPONSE at or under the threshold", () => {
    expect(types(ok({ responseTimeMs: 1500 }))).not.toContain("SLOW_RESPONSE");
  });

  it("raises REDIRECT when the check followed a redirect", () => {
    expect(types(ok({ redirected: true }))).toContain("REDIRECT");
  });

  it("raises SSL_EXPIRING when the cert expires within the window", () => {
    const soon = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(types(ok({ certExpiresAt: soon }))).toContain("SSL_EXPIRING");
  });

  it("does not raise SSL_EXPIRING when the cert is far from expiry", () => {
    const far = new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(types(ok({ certExpiresAt: far }))).not.toContain("SSL_EXPIRING");
  });

  it("raises TITLE_CHANGED when the title differs from the previous check", () => {
    expect(types(ok({ pageTitle: "New" }), ctx({ previousTitle: "Old" }))).toContain("TITLE_CHANGED");
  });

  it("does not raise TITLE_CHANGED when the title is unchanged", () => {
    expect(types(ok({ pageTitle: "Same" }), ctx({ previousTitle: "Same" }))).not.toContain("TITLE_CHANGED");
  });

  it("raises RECOVERED when a previously failing URL now succeeds", () => {
    expect(types(ok(), ctx({ hadOpenFailure: true }))).toContain("RECOVERED");
  });

  it("resolves open failures on any successful check", () => {
    expect(deriveAlerts(ok(), ctx()).resolveOpenFailures).toBe(true);
  });

  it("raises no alerts for a clean, fast, first-seen success", () => {
    expect(deriveAlerts(ok(), ctx()).inserts).toEqual([]);
  });
});
