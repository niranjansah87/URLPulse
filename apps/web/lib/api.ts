import type { ApiError, ApiSuccess, ErrorCode } from "@urlpulse/types";

/**
 * Browser/server-safe API client. Only NEXT_PUBLIC_* env reaches the client
 * bundle; server secrets never do. Every call returns the `data` payload or
 * throws an ApiClientError with a stable, user-mappable `code` - components
 * never see raw fetch/transport errors.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
/** Origin of the API (no /api suffix) - used for auth and SSE endpoints. */
export const API_ORIGIN = API_BASE.replace(/\/api$/, "");
/**
 * Base used for calls made from the Next.js server (Server Components). Lets
 * deployments point at an internal service address (and, in dev, IPv4 loopback -
 * Node may resolve `localhost` to ::1 while the API binds IPv4). Browser calls
 * always use the public API_BASE.
 */
const SERVER_API_BASE = (process.env.API_INTERNAL_URL ?? API_BASE.replace("://localhost", "://127.0.0.1")).replace(/\/$/, "");
function baseFor(): string {
  return typeof window === "undefined" ? SERVER_API_BASE : API_BASE;
}

export type ClientErrorCode = ErrorCode | "NETWORK_ERROR" | "TIMEOUT" | "UNAUTHORIZED" | "FORBIDDEN";

export class ApiClientError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  readonly details?: unknown[];

  constructor(code: ClientErrorCode, status: number, message: string, details?: unknown[]) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Short, user-safe message. Never leaks server internals. */
  get userMessage(): string {
    switch (this.code) {
      case "NETWORK_ERROR":
        return "Can't reach URLPulse. Check your connection and try again.";
      case "TIMEOUT":
        return "The request took too long. Please try again.";
      case "UNAUTHORIZED":
        return "Please sign in to continue.";
      case "FORBIDDEN":
        return "You don't have access to this resource.";
      case "NOT_FOUND":
        return "We couldn't find what you're looking for.";
      case "VALIDATION_ERROR":
        return this.message || "Some of the input is invalid.";
      case "CONFLICT":
        return this.message || "That action isn't possible in the current state.";
      case "NOT_IMPLEMENTED":
        return "This feature isn't available yet.";
      default:
        return "Something went wrong on our side. Please try again.";
    }
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Milliseconds before the request is aborted. */
  timeoutMs?: number;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { body, timeoutMs = 15_000, headers, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${baseFor()}${path}`, {
      ...init,
      credentials: "include",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(body !== undefined && !isForm ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") throw new ApiClientError("TIMEOUT", 0, "Request timed out");
    throw new ApiClientError("NETWORK_ERROR", 0, "Network error");
  }
  clearTimeout(timer);

  if (!res.ok) {
    let parsed: ApiError | null = null;
    try {
      parsed = (await res.json()) as ApiError;
    } catch {
      parsed = null;
    }
    const code: ClientErrorCode =
      res.status === 401 ? "UNAUTHORIZED" : res.status === 403 ? "FORBIDDEN" : (parsed?.error.code as ErrorCode | undefined) ?? "INTERNAL_ERROR";
    throw new ApiClientError(code, res.status, parsed?.error.message ?? res.statusText, parsed?.error.details);
  }

  const json = (await res.json()) as ApiSuccess<T> & { meta?: Record<string, unknown> };
  return { data: json.data, meta: json.meta };
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>(path, { ...opts, method: "POST", body }),
};
