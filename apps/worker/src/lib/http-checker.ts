/**
 * Outbound URL health checker.
 *
 * Every check is bounded three ways so one URL cannot harm the worker:
 *  - time:      an AbortController aborts after `timeoutMs`
 *  - redirects: at most `maxRedirects` hops, followed manually
 *  - body:      at most `maxBodyBytes` are read (title extraction only)
 *
 * Redirects are followed manually (`redirect: "manual"`) so each hop's protocol
 * can be validated. NOTE (Phase 12 seam): `assertAllowedTarget` currently only
 * enforces the scheme; SSRF host/IP validation (loopback, private ranges, cloud
 * metadata, DNS rebinding) is added here in the security phase and must run for
 * the initial URL and every redirect target.
 */
export interface UrlCheckResult {
  status: "SUCCESS" | "FAILED";
  httpStatus: number | null;
  responseTimeMs: number | null;
  pageTitle: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** Whether the failure is transient. Consumed by the retry phase (ADR-023). */
  retryable: boolean;
}

export interface CheckOptions {
  timeoutMs: number;
  maxRedirects: number;
  maxBodyBytes: number;
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

/** Phase 12 extends this with resolved-IP/SSRF checks. */
function assertAllowedTarget(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TargetError("UNSUPPORTED_PROTOCOL", `Unsupported protocol: ${url.protocol}`);
  }
}

export async function checkUrl(rawUrl: string, opts: CheckOptions): Promise<UrlCheckResult> {
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
      assertAllowedTarget(current);

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
          return failed(res.status, elapsed(startedAt), "REDIRECT_LIMIT", "Too many redirects", false);
        }
        current = new URL(location, current);
        continue;
      }

      const pageTitle = await readTitle(res, opts.maxBodyBytes);
      const responseTimeMs = elapsed(startedAt);
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
      };
    }

    return failed(null, elapsed(startedAt), "NO_RESPONSE", "No usable response", true);
  } catch (err) {
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
): UrlCheckResult {
  return { status: "FAILED", httpStatus, responseTimeMs, pageTitle: null, errorCode, errorMessage, retryable };
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
