import { z } from "zod";
import { loadServerConfig } from "@urlpulse/config";

/** Loaded and validated once per process. Fails fast on misconfiguration. */
export const config = loadServerConfig();

/**
 * API-only configuration. Kept separate from the shared @urlpulse/config schema
 * so the worker process — which never mounts auth — is not forced to carry an
 * auth secret. BETTER_AUTH_SECRET signs session cookies; it MUST be a fixed,
 * shared value so sessions stay valid across restarts and across horizontally
 * scaled API instances. In production it is required and startup fails without
 * it; in development/test a clearly-insecure fixed default is used so local runs
 * and the test suite need no extra setup.
 */
const DEV_AUTH_SECRET = "urlpulse-dev-insecure-secret-change-in-production";

const apiEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters").optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
});

function loadApiConfig(source: Record<string, string | undefined> = process.env) {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid URLPulse API configuration:\n${issues}`);
  }
  const { BETTER_AUTH_SECRET, ...rest } = result.data;
  if (!BETTER_AUTH_SECRET && config.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }
  return { ...rest, BETTER_AUTH_SECRET: BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET };
}

export type ApiConfig = ReturnType<typeof loadApiConfig>;
export const apiConfig = loadApiConfig();
