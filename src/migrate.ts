import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "./db";

async function migrate() {
  const migrationPath = path.join(
    process.cwd(),
    "src",
    "migrations",
    "001_create_logs.sql",
  );

  const migration = await readFile(migrationPath, "utf8");

  await sql.unsafe(migration);

  console.log("Migrations applied successfully");

  await sql.end();
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
