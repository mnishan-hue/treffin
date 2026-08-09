import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.STAGING_DATABASE_URL;
if (!connectionString) throw new Error("STAGING_DATABASE_URL is required; production fallbacks are intentionally disabled.");
if (process.env.CONFIRM_STAGING_MIGRATION !== "APPLY_RELATIONAL_INTEGRITY") {
  throw new Error("Set CONFIRM_STAGING_MIGRATION=APPLY_RELATIONAL_INTEGRITY to confirm this staging-only migration.");
}

const migrationsUrl = new URL("../migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsUrl))
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/i.test(name))
  .sort();
if (migrationFiles.length === 0) throw new Error("No migrations found.");

const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const client = await pool.connect();
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");
    await client.query("BEGIN READ WRITE");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('treffin_ordered_migrations'))");
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(new URL(migrationFile, migrationsUrl), "utf8");
      await client.query(sql);
      process.stdout.write(`Applied ${migrationFile}.\n`);
    }
    await client.query("COMMIT");
    process.stdout.write(`${migrationFiles.length} staging migration(s) applied successfully.\n`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "MIGRATION_ERROR";
    throw new Error(`Staging migration failed and was rolled back (${code}).`);
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}