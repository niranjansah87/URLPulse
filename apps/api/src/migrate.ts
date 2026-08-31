import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "./lib/db";

/**
 * Minimal forward-only migration runner. Applies every unapplied .sql file in
 * migrations/ (sorted by name) inside its own transaction and records it in
 * schema_migrations. Reproducible from an empty database; no ORM required.
 * See docs/03-backend/database.md §18.
 */
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

async function main(): Promise<void> {
  const sql = createDb();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const appliedRows = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
    const applied = new Set(appliedRows.map((row) => row.name));

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const text = await readFile(join(migrationsDir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      });
      console.log(`applied ${file}`);
      count += 1;
    }
    console.log(count === 0 ? "migrations up to date" : `applied ${count} migration(s)`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
