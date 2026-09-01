import "server-only";
import { cookies } from "next/headers";
import { API_ORIGIN } from "./api";

const SERVER_AUTH_ORIGIN = (process.env.API_INTERNAL_URL ?? `${API_ORIGIN.replace("://localhost", "://127.0.0.1")}/api`).replace(/\/api\/?$/, "");

/**
 * Server-side auth helpers. Server Components have no browser cookie jar, so
 * calls to the API from the server must forward the incoming request's cookies
 * explicitly; otherwise every protected endpoint answers 401. The session
 * cookie is host-scoped (not port-scoped), so this works for localhost dev and
 * any same-site deployment.
 */
export async function serverAuthHeaders(): Promise<Record<string, string>> {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return cookie ? { cookie } : {};
}

export interface ServerSessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export type ServerSessionResult =
  | { status: "authenticated"; user: ServerSessionUser }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

/** Validates the session against the API. Network failure = "unavailable" (never a false logout). */
export async function getServerSession(): Promise<ServerSessionResult> {
  try {
    const res = await fetch(`${SERVER_AUTH_ORIGIN}/api/auth/get-session`, {
      headers: { accept: "application/json", ...(await serverAuthHeaders()) },
      cache: "no-store",
    });
    if (!res.ok) return { status: "unavailable" };
    const body = (await res.json()) as { user?: ServerSessionUser } | null;
    if (!body?.user) return { status: "unauthenticated" };
    return { status: "authenticated", user: body.user };
  } catch {
    return { status: "unavailable" };
  }
}
