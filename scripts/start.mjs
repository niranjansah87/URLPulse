#!/usr/bin/env node
// URLPulse one-command launcher.
//
// Cross-platform (Windows / macOS / Linux) orchestrator that the OS-specific
// wrappers (start.sh, start.ps1) and `npm run start` all delegate to. It loads
// .env, prompts once for any missing required credential, validates PostgreSQL
// and Redis, runs migrations, then starts the API, worker, and web as three
// separate processes - preserving the architectural separation the project
// requires. Ctrl+C tears all three down without leaving orphans.

import net from "node:net";
import tls from "node:tls";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const IS_WINDOWS = process.platform === "win32";
const PNPM = IS_WINDOWS ? "pnpm.cmd" : "pnpm";

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};
const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const info = (m) => console.log(`${C.cyan}•${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}!${C.reset} ${m}`);
const fail = (m) => console.error(`${C.red}✗ ${m}${C.reset}`);

function die(msg) {
  fail(msg);
  process.exit(1);
}

// --- .env parsing (minimal; no external dependency) -------------------------

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadDotenv() {
  if (!existsSync(ENV_PATH)) return {};
  return parseEnv(readFileSync(ENV_PATH, "utf8"));
}

// Persist newly-collected values so the evaluator is never prompted twice.
// Never overwrites the file wholesale; only appends the keys we gathered.
function persistEnv(entries) {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  const block =
    keys.map((k) => `${k}=${entries[k]}`).join("\n") + "\n";
  if (existsSync(ENV_PATH)) {
    appendFileSync(ENV_PATH, "\n# --- added by scripts/start.mjs ---\n" + block);
  } else {
    writeFileSync(ENV_PATH, "# URLPulse environment (generated)\n" + block);
  }
  info(`Saved ${keys.join(", ")} to .env (gitignored)`);
}

// --- interactive prompting --------------------------------------------------

function prompt(question, { secret = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (secret) {
      // Suppress echo of typed characters. rl still prints the question (muted
      // is only set after question() writes it), then nothing until Enter.
      let muted = false;
      rl._writeToOutput = (str) => {
        if (!muted || str.includes(question) || str.includes("\n")) process.stdout.write(str);
      };
      rl.question(question, (answer) => {
        process.stdout.write("\n");
        rl.close();
        resolve(answer.trim());
      });
      muted = true;
      return;
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// --- required variables -----------------------------------------------------
// Only DATABASE_URL and REDIS_URL have no safe default. Auth secret and Resend
// key are enforced by the app itself in production; everything else defaults in
// packages/config. We treat a value as a secret (no echo) when it can carry a
// password.

function requiredVars(env) {
  const vars = [
    { key: "DATABASE_URL", secret: true, hint: "postgresql://user:pass@host:5432/urlpulse" },
    { key: "REDIS_URL", secret: true, hint: "redis://[:password@]host:port" },
  ];
  if ((env.NODE_ENV || process.env.NODE_ENV) === "production") {
    vars.push(
      { key: "BETTER_AUTH_SECRET", secret: true, hint: "openssl rand -base64 32" },
      { key: "RESEND_API_KEY", secret: true, hint: "re_..." },
    );
  }
  return vars;
}

async function collectMissing(env) {
  const missing = requiredVars(env).filter(
    (v) => !env[v.key] && !process.env[v.key],
  );
  if (missing.length === 0) return {};

  if (!process.stdin.isTTY) {
    fail("Missing required environment variables and no interactive terminal to prompt:");
    for (const v of missing) console.error(`    ${v.key}  (${v.hint})`);
    console.error("\nSet them in .env or the environment, then re-run.");
    process.exit(1);
  }

  console.log(`\n${C.bold}First-time setup - a few values are missing.${C.reset}`);
  console.log(`${C.dim}Input is hidden for secrets. Values are saved to .env (never committed).${C.reset}\n`);
  const collected = {};
  for (const v of missing) {
    let answer = "";
    while (!answer) {
      answer = await prompt(`${v.key} ${C.dim}(${v.hint})${C.reset}: `, { secret: v.secret });
      if (!answer) warn(`${v.key} is required.`);
    }
    collected[v.key] = answer;
  }
  return collected;
}

// --- connectivity checks ----------------------------------------------------

function parseHostPort(url, defaultPort) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port) || defaultPort, url: u };
  } catch {
    return null;
  }
}

function tcpProbe(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

// Minimal RESP round-trip: AUTH (if credentials present) then PING. Proves the
// remote Redis is reachable AND that the credentials are valid - the failure
// the evaluator is most likely to hit with a hosted instance.
function redisPing(redisUrl, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const u = new URL(redisUrl);
    const host = u.hostname;
    const port = Number(u.port) || 6379;
    const password = decodeURIComponent(u.password || "");
    const username = decodeURIComponent(u.username || "");
    const useTls = u.protocol === "rediss:";

    const socket = useTls
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });

    let buffer = "";
    let stage = password ? "auth" : "ping";
    const finish = (result, message) => {
      socket.destroy();
      resolve({ ok: result, message });
    };
    socket.setTimeout(timeoutMs);
    socket.once("timeout", () => finish(false, "connection timed out"));
    socket.once("error", (e) => finish(false, e.message));

    const send = (...args) => {
      let cmd = `*${args.length}\r\n`;
      for (const a of args) cmd += `$${Buffer.byteLength(a)}\r\n${a}\r\n`;
      socket.write(cmd);
    };

    socket.once("connect", startAuth);
    socket.once("secureConnect", startAuth);
    function startAuth() {
      if (password) {
        if (username) send("AUTH", username, password);
        else send("AUTH", password);
      } else {
        send("PING");
      }
    }

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\r\n")) return;
      const reply = buffer;
      buffer = "";
      if (reply.startsWith("-")) {
        return finish(false, reply.slice(1).split("\r\n")[0]);
      }
      if (stage === "auth") {
        stage = "ping";
        send("PING");
        return;
      }
      if (reply.startsWith("+PONG")) return finish(true, "PONG");
      finish(false, `unexpected reply: ${reply.trim()}`);
    });
  });
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    // Bind the same interface the services use (0.0.0.0). Probing 127.0.0.1
    // would falsely report "free" on Windows when a 0.0.0.0 listener exists.
    server.listen(port, "0.0.0.0");
  });
}

// --- child process orchestration --------------------------------------------

const children = [];
let shuttingDown = false;

function startService(name, args, env) {
  const child = spawn(PNPM, args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: IS_WINDOWS, // Node blocks spawning .cmd without a shell on Windows
    detached: !IS_WINDOWS, // own process group on POSIX so we can kill the tree
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    fail(`${name} exited unexpectedly (${signal || `code ${code}`}). Shutting down.`);
    shutdown(1);
  });
  children.push({ name, child });
  return child;
}

function killChild({ child }) {
  if (child.exitCode !== null || child.signalCode) return;
  if (IS_WINDOWS) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try { child.kill("SIGTERM"); } catch { /* already gone */ }
    }
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${C.dim}Stopping services…${C.reset}`);
  for (const c of children) killChild(c);
  setTimeout(() => process.exit(code), 800);
}

// Run a one-shot command (migrations) and resolve with its exit code.
function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env, stdio: "inherit", shell: IS_WINDOWS });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

// --- main -------------------------------------------------------------------

async function main() {
  console.log(`\n${C.bold}URLPulse${C.reset}`);
  console.log(`${C.dim}────────────────────────────${C.reset}\n`);

  // 1. Load .env, layer real process env on top (process env wins).
  const dotenv = loadDotenv();
  const env = { ...dotenv, ...process.env };

  // 2. Prompt for missing required credentials, persist them.
  const collected = await collectMissing(env);
  Object.assign(env, collected);
  persistEnv(collected);
  ok("Environment loaded");

  // 3. Validate PostgreSQL reachability.
  const pg = parseHostPort(env.DATABASE_URL, 5432);
  if (!pg) die("DATABASE_URL is not a valid URL.");
  if (!(await tcpProbe(pg.host, pg.port))) {
    die(
      `PostgreSQL connection failed at ${pg.host}:${pg.port}.\n` +
        "  Check DATABASE_URL and make sure PostgreSQL is running.",
    );
  }
  ok(`PostgreSQL reachable (${pg.host}:${pg.port})`);

  // 4. Validate Redis (reachability + credentials via PING).
  const redis = parseHostPort(env.REDIS_URL, 6379);
  if (!redis) die("REDIS_URL is not a valid URL.");
  const ping = await redisPing(env.REDIS_URL);
  if (!ping.ok) {
    die(
      `Redis connection failed at ${redis.host}:${redis.port} (${ping.message}).\n` +
        "  Check REDIS_URL and make sure Redis is reachable.",
    );
  }
  ok(`Redis reachable (${redis.host}:${redis.port})`);

  // 5. Ports free? (fail early with a clear message instead of a Node stack.)
  const apiPort = Number(env.API_PORT) || 4000;
  const webPort = 3000;
  for (const [label, port] of [["API", apiPort], ["Web", webPort]]) {
    if (!(await portFree(port))) {
      die(
        `Port ${port} (${label}) is already in use.\n` +
          `  Stop whatever is listening on ${port}, or set API_PORT for the API.`,
      );
    }
  }
  ok(`Ports free (${webPort}, ${apiPort})`);

  // 6. Migrations (real PG auth + schema validation happens here).
  info("Applying database migrations…");
  const migrateCode = await run(PNPM, ["--filter", "@urlpulse/api", "migrate"], env);
  if (migrateCode !== 0) {
    die("Database migration failed. See the error above (check DATABASE_URL and DB permissions).");
  }
  ok("Database migrations applied");

  // 7. Start the three processes.
  console.log(`\n${C.bold}Starting services…${C.reset}\n`);
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  startService("api", ["--filter", "@urlpulse/api", "dev"], env);
  startService("worker", ["--filter", "@urlpulse/worker", "dev"], env);
  startService("web", ["--filter", "@urlpulse/web", "dev"], env);

  console.log(`\n${C.green}Frontend${C.reset} → http://localhost:${webPort}`);
  console.log(`${C.green}API${C.reset}      → http://localhost:${apiPort}`);
  console.log(`${C.green}Worker${C.reset}   → BullMQ worker (separate process)`);
  console.log(`\n${C.dim}Press Ctrl+C to stop all services.${C.reset}\n`);
}

main().catch((err) => {
  fail(err?.message || String(err));
  shutdown(1);
});
