import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { config } from "./config.js";

function getMigrationFiles() {
  const dir = path.resolve(process.cwd(), "migrations");
  if (!fs.existsSync(dir)) {
    throw new Error(`Migration directory not found: ${dir}`);
  }

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      version: name,
      fullPath: path.join(dir, name),
      sql: fs.readFileSync(path.join(dir, name), "utf-8")
    }));
}

export async function runMigrations() {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run SQL migrations.");
  }

  const client = new Client({ connectionString: config.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRows = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations"
    );
    const appliedSet = new Set(appliedRows.rows.map((r) => r.version));

    const migrations = getMigrationFiles();

    for (const migration of migrations) {
      if (appliedSet.has(migration.version)) continue;

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [migration.version]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration failed (${migration.version}): ${(error as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}
