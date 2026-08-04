import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// NEON_DATABASE_URL takes priority — set this secret to point to your Neon DB.
// Falls back to the Replit-provisioned DATABASE_URL for local dev.
const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set NEON_DATABASE_URL (or DATABASE_URL).",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
