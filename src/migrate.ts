import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "./db.js";

export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const migrationsDir = path.join(
    process.cwd(),
    "src",
    "migrations",
  );

  const files = await readdir(migrationsDir);

  const migrations = files
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migrationName of migrations) {
    const existing = await sql`
      SELECT name
      FROM schema_migrations
      WHERE name = ${migrationName}
    `;

    if (existing.length > 0) {
      console.log(`Migration already applied: ${migrationName}`);
      continue;
    }

    const migrationPath = path.join(
      migrationsDir,
      migrationName,
    );

    const migration = await readFile(migrationPath, "utf8");

    await sql.unsafe(migration);

    await sql`
      INSERT INTO schema_migrations (name)
      VALUES (${migrationName})
    `;

    console.log(`Applied migration: ${migrationName}`);
  }

}

