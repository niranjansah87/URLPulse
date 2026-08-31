/**
 * Outbound URL health checker.
 *
 * Every check is bounded three ways so one URL cannot harm the worker:
 *  - time:      an AbortController aborts after `timeoutMs`
 *  - redirects: at most `maxRedirects` hops, followed manually
 *  - body:      at most `maxBodyBytes` are read (title extraction only)
 *
 * Redirects are followed manually (`redirect: "manual"`) so each hop's protocol
 * and target can be validated, and — critically — so that EVERY outbound request
 * is counted by the global rate limiter. Following a redirect issues another real
 * HTTP request, so `onRequest` (the global rate permit) is acquired before every
 * hop, not just the first; otherwise a redirect chain would let one permit fan
 * out into several outbound requests and break the global 10 req/s guarantee.
 *
 * `onRequest` failures are infrastructure failures (e.g. Redis down during
 * admission), not URL failures: they propagate out of `checkUrl` so the worker
 * returns the URL to PENDING and retries, rather than marking it FAILED.
 */
import { connect as tlsConnect } from "node:tls";
import { assertPublicUrl, BlockedTargetError } from "./ssrf";

export interface UrlCheckResult {
  status: "SUCCESS" | "FAILED";
  httpStatus: number | null;
  responseTimeMs: number | null;
  pageTitle: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Whether the failure is transient. Consumed by the retry phase (ADR-023). */
  retryable: boolean;
  /** True when the final response was reached via one or more redirects. */
  redirected: boolean;
  /** TLS certificate expiry (ISO) for the final https host, best-effort; null otherwise. */
  certExpiresAt: string | null;
}

export interface CheckOptions {
  timeoutMs: number;
  maxRedirects: number;
  maxBodyBytes: number;
  /** Allow loopback/private targets. Only for local dev/tests; false in prod. */
  allowPrivateHosts: boolean;
}

const USER_AGENT = "URLPulse-HealthChecker/1.0";

class TargetError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps an `onRequest` (admission) failure so it is rethrown as-is, never
 * misclassified as a URL network failure. */
class AdmissionError extends Error {
  constructor(readonly reason: unknown) {
    super("admission failed");
  }
}

/** Acquire a global rate permit for one outbound request; injected by the worker. */
export type OnRequest = () => Promise<void>;

async function assertAllowedTarget(url: URL, allowPrivateHosts: boolean): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TargetError("UNSUPPORTED_PROTOCOL", `Unsupported protocol: ${url.protocol}`);
  }
  if (allowPrivateHosts) return;
  try {
    await assertPublicUrl(url);
  } catch (err) {
    if (err instanceof BlockedTargetError) throw new TargetError(err.code, err.message);
    throw err;
  }
}

export async function checkUrl(
  rawUrl: string,
  opts: CheckOptions,
  onRequest?: OnRequest,
): Promise<UrlCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const startedAt = Date.now();

  try {
    let current: URL;
    try {
      current = new URL(rawUrl);
    } catch {
      return failed(null, null, "INVALID_URL", "URL is not parseable", false);
    }

    for (let hops = 0; ; hops += 1) {
      await assertAllowedTarget(current, opts.allowPrivateHosts);

      // Every hop is a real outbound request: acquire a global rate permit for
      // each. A blocked target above never reaches here, so it consumes no permit.
      if (onRequest) {
        try {
          await onRequest();
        } catch (err) {
          throw new AdmissionError(err);
        }
      }

      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "*/*" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        void res.body?.cancel().catch(() => undefined);
        if (!location) break; // treat as a final (odd) response
        if (hops >= opts.maxRedirects) {
          return failed(res.status, elapsed(startedAt), "REDIRECT_LIMIT", "Too many redirects", false, true);
        }
        current = new URL(location, current);
        continue;
      }

      const pageTitle = await readTitle(res, opts.maxBodyBytes);
      const responseTimeMs = elapsed(startedAt);
      const redirected = hops > 0;
      const certExpiresAt = await readCertExpiry(current, opts.timeoutMs);
      if (res.status >= 400) {
        // 5xx is transient; 4xx is a deterministic client error. (Phase 3 refines.)
        const retryable = res.status >= 500;
        return {
          status: "FAILED",
          httpStatus: res.status,
          responseTimeMs,
          pageTitle,
          errorCode: `HTTP_${res.status}`,
          errorMessage: `Received HTTP ${res.status}`,
          retryable,
          redirected,
          certExpiresAt,
        };
      }
      return {
        status: "SUCCESS",
        httpStatus: res.status,
        responseTimeMs,
        pageTitle,
        errorCode: null,
        errorMessage: null,
        retryable: false,
        redirected,
        certExpiresAt,
      };
    }

    return failed(null, elapsed(startedAt), "NO_RESPONSE", "No usable response", true);
  } catch (err) {
    // Admission (rate-limiter/Redis) failure is infrastructure, not a URL result:
    // rethrow so the worker returns the URL to PENDING and retries.
    if (err instanceof AdmissionError) throw err.reason;
    if (err instanceof TargetError) {
      return failed(null, elapsed(startedAt), err.code, err.message, false);
    }
    if (controller.signal.aborted) {
      return failed(null, elapsed(startedAt), "TIMEOUT", "Request timed out", true);
    }
    return failed(null, elapsed(startedAt), "NETWORK_ERROR", messageOf(err), true);
  } finally {
    clearTimeout(timer);
  }
}

function elapsed(startedAt: number): number {
  return Date.now() - startedAt;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown network error";
}

function failed(
  httpStatus: number | null,
  responseTimeMs: number | null,
  errorCode: string,
  errorMessage: string,
  retryable: boolean,
  redirected = false,
): UrlCheckResult {
  return {
    status: "FAILED",
    httpStatus,
    responseTimeMs,
    pageTitle: null,
    errorCode,
    errorMessage,
    retryable,
    redirected,
    certExpiresAt: null,
  };
}

/**
 * Best-effort TLS certificate expiry for an https host. A short, separate
 * handshake (undici's fetch does not expose the peer certificate). Never throws:
 * any failure yields null so a cert probe can only add an alert, never fail a
 * check. Not an HTTP request, so it consumes no rate permit.
 */
function readCertExpiry(url: URL, timeoutMs: number): Promise<string | null> {
  if (url.protocol !== "https:") return Promise.resolve(null);
  return new Promise((resolve) => {
    const port = url.port ? Number(url.port) : 443;
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    const socket = tlsConnect(
      { host: url.hostname, port, servername: url.hostname, timeout: Math.min(timeoutMs, 5000) },
      () => {
        const cert = socket.getPeerCertificate();
        const validTo = cert && cert.valid_to ? new Date(cert.valid_to) : null;
        done(validTo && !Number.isNaN(validTo.getTime()) ? validTo.toISOString() : null);
      },
    );
    socket.once("timeout", () => done(null));
    socket.once("error", () => done(null));
  });
}

/** Read at most maxBytes of the body and extract a trimmed <title>, if any. */
async function readTitle(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
      }
    }
  } catch {
    return null;
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  const html = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    .subarray(0, maxBytes)
    .toString("utf8");
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match || match[1] === undefined) return null;
  const title = match[1].replace(/\s+/g, " ").trim();
  return title.length > 0 ? title.slice(0, 512) : null;
}
