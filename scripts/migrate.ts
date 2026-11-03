import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
import { getDatabaseUrl } from "../lib/env.js";

neonConfig.webSocketConstructor = WebSocket;

const migrationFilePattern = /^\d+_[a-z0-9][a-z0-9_-]*\.sql$/;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(scriptDirectory, "..", "migrations");
const localEnvironmentFile = join(scriptDirectory, "..", ".env.local");

type AppliedMigration = {
  filename: string;
  checksum: string;
};

function checksum(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function getMigrationFiles(): Promise<string[]> {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function migrate(): Promise<void> {
  if (existsSync(localEnvironmentFile)) {
    process.loadEnvFile(localEnvironmentFile);
  }

  const databaseUrl = getDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum char(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const appliedResult = await client.query<AppliedMigration>(
      "SELECT filename, checksum FROM schema_migrations ORDER BY filename"
    );
    const applied = new Map(
      appliedResult.rows.map((migration) => [migration.filename, migration.checksum])
    );

    for (const filename of await getMigrationFiles()) {
      const contents = await readFile(join(migrationsDirectory, filename), "utf8");
      const migrationChecksum = checksum(contents);
      const appliedChecksum = applied.get(filename);

      if (appliedChecksum) {
        if (appliedChecksum !== migrationChecksum) {
          throw new Error(
            `Migration ${filename} was changed after being applied. Create a new migration instead.`
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(contents);
        await client.query(
          "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
          [filename, migrationChecksum]
        );
        await client.query("COMMIT");
        console.log(`Applied ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
