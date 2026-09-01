import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@urlpulse/types"],
  // Emit a self-contained server (.next/standalone) so the production image
  // ships only traced runtime files, not the whole pnpm workspace. In a monorepo
  // the trace root must be the repo root so workspace deps (@urlpulse/types) are
  // included.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
