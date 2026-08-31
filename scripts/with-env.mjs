#!/usr/bin/env node
// Load the root .env into the environment, then exec the given command with it.
// Used so `pnpm test` (and other tasks) run from a clean shell without the
// evaluator having to export DATABASE_URL / REDIS_URL by hand. The app itself
// is started by scripts/start.mjs, which loads .env the same way.

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (existsSync(envPath)) {
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // real env wins
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(cmd, args, { cwd: root, env: process.env, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
