import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. It talks to the Better Auth handler mounted on the Fastify
 * API (a separate origin), so every request must send the session cookie -
 * `credentials: "include"`. The base URL is the API origin; Better Auth appends
 * its own /api/auth path. Derived from NEXT_PUBLIC_API_URL (".../api" → origin)
 * so there is a single source of truth for where the API lives.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const baseURL = apiUrl.replace(/\/api\/?$/, "");

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession } = authClient;
