import { assertPublicUrl, BlockedTargetError } from "./ssrf";

/**
 * Synchronous, unauthenticated URL check for the landing-page demo. A trimmed
 * cousin of the worker's checkUrl (apps/worker/src/lib/http-checker.ts): same
 * SSRF guard and bounds, but no persistence, no queue, and no global rate
 * permit. Anon abuse is contained by a small URL cap and a per-IP rate limit at
 * the route; results are returned inline and never stored.
 *
 * FIXME(niranjansah87): fold into the shared checker once ssrf + the checker move
 * to @urlpulse/net-guard, so the demo counts toward the global 10 req/s limit.
 */
export interface DemoCheckResult {
  url: string;
  ok: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  pageTitle: string | null;
  error: string | null;
}

const USER_AGENT = "URLPulse-Demo/1.0";
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 64 * 1024;

export async function checkOne(rawUrl: string): Promise<DemoCheckResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const fail = (error: string, httpStatus: number | null = null): DemoCheckResult => ({
    url: rawUrl,
    ok: false,
    httpStatus,
    responseTimeMs: null,
    pageTitle: null,
    error,
  });

  try {
    let current: URL;
    try {
      current = new URL(rawUrl);
    } catch {
      return fail("Invalid URL");
    }

    for (let hops = 0; ; hops += 1) {
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        return fail("Unsupported protocol");
      }
      try {
        await assertPublicUrl(current);
      } catch (err) {
        if (err instanceof BlockedTargetError) return fail("Blocked or unresolvable target");
        throw err;
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
        if (!location) break;
        if (hops >= MAX_REDIRECTS) return fail("Too many redirects", res.status);
        current = new URL(location, current);
        continue;
      }

      const pageTitle = await readTitle(res, MAX_BODY_BYTES);
      return {
        url: rawUrl,
        ok: res.status < 400,
        httpStatus: res.status,
        responseTimeMs: Date.now() - startedAt,
        pageTitle,
        error: res.status >= 400 ? `HTTP ${res.status}` : null,
      };
    }
    return fail("No usable response");
  } catch (err) {
    if (controller.signal.aborted) return fail("Request timed out");
    return fail(err instanceof Error ? "Network error" : "Unknown error");
  } finally {
    clearTimeout(timer);
  }
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
