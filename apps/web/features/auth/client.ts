"use client";

/**
 * Single Better Auth browser client for the app. The instance lives in
 * `@/lib/auth-client` (credentialed cross-origin fetch to the Fastify API);
 * this module re-exports it so feature code has one import path.
 */
export { authClient } from "@/lib/auth-client";
