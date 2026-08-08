import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.STAGING_DATABASE_URL;
if (!connectionString) throw new Error("STAGING_DATABASE_URL is required; production fallbacks are intentionally disabled.");
if (process.env.CONFIRM_STAGING_MIGRATION !== "APPLY_RELATIONAL_INTEGRITY") {
  throw new Error("Set CONFIRM_STAGING_MIGRATION=APPLY_RELATIONAL_INTEGRITY to confirm this staging-only migration.");
}

const sql = await readFile(new URL("../migrations/0001_relational_integrity.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const client = await pool.connect();
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");
    await client.query("BEGIN READ WRITE");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('treffin_relational_integrity_0001'))");
    await client.query(sql);
    await client.query("COMMIT");
    process.stdout.write("Staging migration 0001 applied successfully.\n");
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