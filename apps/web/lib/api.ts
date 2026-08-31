import type { ApiSuccess } from "@urlpulse/types";

/**
 * Browser-safe API base. Only NEXT_PUBLIC_* env vars reach the client bundle;
 * server secrets (DATABASE_URL, REDIS_URL) never do. Not yet used by the shell
 * pages — wired in when the batch endpoints are implemented.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }
  const body = (await res.json()) as ApiSuccess<T>;
  return body.data;
}
