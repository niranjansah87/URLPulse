import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { checkUrl, type CheckOptions } from "./http-checker";

const OPTS: CheckOptions = {
  timeoutMs: 1000,
  maxRedirects: 5,
  maxBodyBytes: 65_536,
  allowPrivateHosts: true, // the test server is on 127.0.0.1
};

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = req.url ?? "/";
    if (path === "/ok") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><head><title>  Hello  World </title></head><body>x</body></html>");
    } else if (path === "/notfound") {
      res.writeHead(404).end("nope");
    } else if (path === "/error") {
      res.writeHead(500).end("boom");
    } else if (path === "/slow") {
      setTimeout(() => res.writeHead(200).end("late"), 300);
    } else if (path === "/redir") {
      res.writeHead(302, { location: "/ok" }).end();
    } else if (path === "/loop") {
      res.writeHead(302, { location: "/loop" }).end();
    } else {
      res.writeHead(200).end("ok");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("checkUrl", () => {
  it("reports SUCCESS with status and a trimmed page title for a 2xx response", async () => {
    const r = await checkUrl(`${base}/ok`, OPTS);
    expect(r.status).toBe("SUCCESS");
    expect(r.httpStatus).toBe(200);
    expect(r.pageTitle).toBe("Hello World");
  });

  it("reports FAILED and non-retryable for a 404", async () => {
    const r = await checkUrl(`${base}/notfound`, OPTS);
    expect(r.status).toBe("FAILED");
    expect(r.httpStatus).toBe(404);
    expect(r.retryable).toBe(false);
  });

  it("reports FAILED and retryable for a 5xx", async () => {
    const r = await checkUrl(`${base}/error`, OPTS);
    expect(r.httpStatus).toBe(500);
    expect(r.retryable).toBe(true);
  });

  it("follows a bounded redirect to a 2xx", async () => {
    const r = await checkUrl(`${base}/redir`, OPTS);
    expect(r.status).toBe("SUCCESS");
    expect(r.httpStatus).toBe(200);
  });

  it("fails with REDIRECT_LIMIT on a redirect loop", async () => {
    const r = await checkUrl(`${base}/loop`, { ...OPTS, maxRedirects: 2 });
    expect(r.errorCode).toBe("REDIRECT_LIMIT");
  });

  it("times out a slow endpoint and marks it retryable", async () => {
    const r = await checkUrl(`${base}/slow`, { ...OPTS, timeoutMs: 50 });
    expect(r.errorCode).toBe("TIMEOUT");
    expect(r.retryable).toBe(true);
  });

  it("rejects an unsupported protocol without a request", async () => {
    const r = await checkUrl("ftp://example.com/file", OPTS);
    expect(r.errorCode).toBe("UNSUPPORTED_PROTOCOL");
    expect(r.retryable).toBe(false);
  });

  it("reports INVALID_URL for an unparseable input", async () => {
    const r = await checkUrl("not a url", OPTS);
    expect(r.errorCode).toBe("INVALID_URL");
  });

  it("blocks a loopback target when private hosts are not allowed (SSRF)", async () => {
    const r = await checkUrl(`${base}/ok`, { ...OPTS, allowPrivateHosts: false });
    expect(r.errorCode).toBe("BLOCKED_ADDRESS");
    expect(r.status).toBe("FAILED");
  });

  it("acquires one rate permit PER outbound request, including each redirect hop", async () => {
    const direct = vi.fn(async () => {});
    await checkUrl(`${base}/ok`, OPTS, direct);
    expect(direct).toHaveBeenCalledTimes(1);

    const redirected = vi.fn(async () => {});
    const r = await checkUrl(`${base}/redir`, OPTS, redirected);
    expect(r.status).toBe("SUCCESS");
    expect(redirected).toHaveBeenCalledTimes(2); // initial + one redirect = two requests
  });

  it("does not acquire a permit for a target blocked before the request", async () => {
    const onRequest = vi.fn(async () => {});
    await checkUrl(`${base}/ok`, { ...OPTS, allowPrivateHosts: false }, onRequest);
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("propagates an admission failure instead of marking the URL failed", async () => {
    const onRequest = vi.fn(async () => {
      throw new Error("redis down");
    });
    await expect(checkUrl(`${base}/ok`, OPTS, onRequest)).rejects.toThrow("redis down");
  });
});
