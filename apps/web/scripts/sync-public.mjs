/**
 * Mirrors the repository-root public/ folder into apps/web/public so Next.js serves every
 * static asset (favicons, logos, OG image, logo reveal video) at the same paths the docs and
 * pages reference. apps/web/public is gitignored and fully regenerated: the target is removed
 * first so files deleted upstream do not linger. Runs before `next dev` / `next build` via the
 * web app's `dev` and `build` scripts.
 */
import { cp, readdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const source = join(repoRoot, "public");
const webPublic = join(here, "..", "public");

await rm(webPublic, { recursive: true, force: true });
await cp(source, webPublic, { recursive: true });

const copied = (await readdir(webPublic, { recursive: true, withFileTypes: true })).filter((entry) =>
  entry.isFile(),
).length;
console.log(
  `sync-public: mirrored ${copied} files (${relative(repoRoot, source)} -> ${relative(repoRoot, webPublic)})`,
);
