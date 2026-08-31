import { describe, it, expect, vi } from "vitest";
import type { Job } from "bullmq";
import type { UrlCheckJobData } from "@urlpulse/types";
import { createUrlCheckProcessor, RetryableCheckError } from "./url-check";
import type { UrlRepository } from "../repositories/urls";
import type { CheckOptions, UrlCheckResult } from "../lib/http-checker";

const OPTS: CheckOptions = { timeoutMs: 1000, maxRedirects: 5, maxBodyBytes: 1000 };
const MAX_ATTEMPTS = 4;
const noopLog = { info: () => {}, warn: () => {} };
const BATCH = "11111111-1111-1111-1111-111111111111";
const URL_ID = "22222222-2222-2222-2222-222222222222";

const success: UrlCheckResult = {
  status: "SUCCESS",
  httpStatus: 200,
  responseTimeMs: 12,
  pageTitle: "x",
  errorCode: null,
  errorMessage: null,
  retryable: false,
};
const retryableFail: UrlCheckResult = {
  status: "FAILED",
  httpStatus: 503,
  responseTimeMs: 5,
  pageTitle: null,
  errorCode: "HTTP_503",
  errorMessage: "Received HTTP 503",
  retryable: true,
};
const permanentFail: UrlCheckResult = { ...retryableFail, httpStatus: 404, errorCode: "HTTP_404", retryable: false };

function job(data: unknown, attemptsMade = 0): Job<UrlCheckJobData> {
  return { id: "j1", data, attemptsMade } as unknown as Job<UrlCheckJobData>;
}

function repoWith(over: Partial<UrlRepository>): UrlRepository {
  return {
    claim: vi.fn(async () => ({ url: "https://a.com" })),
    persistResult: vi.fn(async () => "applied" as const),
    releaseForRetry: vi.fn(async () => "applied" as const),
    recoverStuck: vi.fn(async () => 0),
    ...over,
  } as UrlRepository;
}

function passLimiter() {
  return { acquire: vi.fn(async () => {}) };
}
function slotLimiter() {
  const release = vi.fn(async () => {});
  return { release, acquire: vi.fn(async () => ({ release })) };
}

function proc(
  repo: UrlRepository,
  checkUrl: () => Promise<UrlCheckResult>,
  rateLimiter: { acquire: () => Promise<void> } = passLimiter(),
  concurrency = slotLimiter(),
) {
  return createUrlCheckProcessor({
    repo,
    checkUrl,
    checkOptions: OPTS,
    concurrency,
    rateLimiter,
    maxAttempts: MAX_ATTEMPTS,
    log: noopLog,
  });
}

describe("urlCheckProcessor", () => {
  it("rejects an invalid job payload before any work", async () => {
    const repo = repoWith({ claim: vi.fn() });
    await expect(proc(repo, vi.fn())(job({}))).rejects.toThrow();
    expect(repo.claim).not.toHaveBeenCalled();
  });

  it("skips the check when the URL cannot be claimed", async () => {
    const repo = repoWith({ claim: vi.fn(async () => null) });
    const checkUrl = vi.fn();
    await proc(repo, checkUrl)(job({ batchId: BATCH, urlId: URL_ID }));
    expect(checkUrl).not.toHaveBeenCalled();
    expect(repo.persistResult).not.toHaveBeenCalled();
  });

  it("persists a successful result exactly once", async () => {
    const repo = repoWith({});
    await proc(repo, vi.fn(async () => success))(job({ batchId: BATCH, urlId: URL_ID }));
    expect(repo.persistResult).toHaveBeenCalledWith(URL_ID, success);
    expect(repo.releaseForRetry).not.toHaveBeenCalled();
  });

  it("releases and re-throws on a retryable failure while attempts remain", async () => {
    const repo = repoWith({});
    await expect(
      proc(repo, vi.fn(async () => retryableFail))(job({ batchId: BATCH, urlId: URL_ID }, 0)),
    ).rejects.toBeInstanceOf(RetryableCheckError);
    expect(repo.releaseForRetry).toHaveBeenCalledWith(URL_ID);
    expect(repo.persistResult).not.toHaveBeenCalled();
  });

  it("persists a terminal FAILED on the last attempt instead of retrying", async () => {
    const repo = repoWith({});
    await proc(repo, vi.fn(async () => retryableFail))(job({ batchId: BATCH, urlId: URL_ID }, MAX_ATTEMPTS - 1));
    expect(repo.releaseForRetry).not.toHaveBeenCalled();
    expect(repo.persistResult).toHaveBeenCalledWith(URL_ID, retryableFail);
  });

  it("does not retry a non-retryable failure", async () => {
    const repo = repoWith({});
    await proc(repo, vi.fn(async () => permanentFail))(job({ batchId: BATCH, urlId: URL_ID }, 0));
    expect(repo.releaseForRetry).not.toHaveBeenCalled();
    expect(repo.persistResult).toHaveBeenCalledWith(URL_ID, permanentFail);
  });

  it("does not re-throw when release is skipped (cancellation won the race)", async () => {
    const repo = repoWith({ releaseForRetry: vi.fn(async () => "skipped" as const) });
    await expect(
      proc(repo, vi.fn(async () => retryableFail))(job({ batchId: BATCH, urlId: URL_ID }, 0)),
    ).resolves.toBeUndefined();
    expect(repo.persistResult).not.toHaveBeenCalled();
  });

  it("acquires a global rate permit before performing the check", async () => {
    const order: string[] = [];
    const rateLimiter = { acquire: vi.fn(async () => void order.push("acquire")) };
    const checkUrl = vi.fn(async () => {
      order.push("check");
      return success;
    });
    await proc(repoWith({}), checkUrl, rateLimiter)(job({ batchId: BATCH, urlId: URL_ID }));
    expect(order).toEqual(["acquire", "check"]);
  });

  it("returns the URL to PENDING when admission throws (infra failure)", async () => {
    const repo = repoWith({});
    const rateLimiter = {
      acquire: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    const concurrency = slotLimiter();
    await expect(
      proc(repo, vi.fn(async () => success), rateLimiter, concurrency)(job({ batchId: BATCH, urlId: URL_ID })),
    ).rejects.toThrow("redis down");
    expect(repo.releaseForRetry).toHaveBeenCalledWith(URL_ID);
    expect(concurrency.release).toHaveBeenCalled(); // slot never leaked
  });

  it("releases the concurrency slot after a successful check", async () => {
    const concurrency = slotLimiter();
    await proc(repoWith({}), vi.fn(async () => success), passLimiter(), concurrency)(
      job({ batchId: BATCH, urlId: URL_ID }),
    );
    expect(concurrency.acquire).toHaveBeenCalledOnce();
    expect(concurrency.release).toHaveBeenCalledOnce();
  });
});
