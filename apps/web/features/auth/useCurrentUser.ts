"use client";

import { authClient } from "./client";

export interface CurrentUser {
  name: string;
  email: string;
  initials: string;
  image: string | null;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "unavailable";

/**
 * Demo identity shown only while the auth service is not reachable (e.g. auth
 * routes not yet mounted on the API). Never used when a real session exists.
 */
const FALLBACK_USER: CurrentUser = {
  name: "Niranjan Sah",
  email: "niranjan@urlpulse.dev",
  initials: "NS",
  image: null,
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Current user for the app shell. Reads the Better Auth session; while the auth
 * backend is unavailable it degrades to a clearly-labelled fallback so the UI
 * keeps working, and reports `status` so callers can distinguish the cases.
 */
export function useCurrentUser(): { user: CurrentUser | null; status: AuthStatus; signOut: () => Promise<void> } {
  const { data, isPending, error } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
  };

  if (isPending) return { user: null, status: "loading", signOut };
  if (error) return { user: FALLBACK_USER, status: "unavailable", signOut };
  if (!data?.user) return { user: null, status: "unauthenticated", signOut };

  const name = data.user.name || data.user.email;
  return {
    user: { name, email: data.user.email, initials: initialsOf(name), image: data.user.image ?? null },
    status: "authenticated",
    signOut,
  };
}
