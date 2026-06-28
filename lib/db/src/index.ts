import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detect whether SSL is needed from the connection string itself.
// Neon and other managed providers include sslmode=require/verify-full.
// The local Replit DB uses sslmode=disable, so we honour that explicitly.
const url = process.env.DATABASE_URL;
const sslDisabled =
  url.includes("sslmode=disable") ||
  url.includes("sslmode=no-ssl") ||
  process.env.DATABASE_SSL === "false";

export const pool = new Pool({
  connectionString: url,
  ...(sslDisabled ? {} : { ssl: { rejectUnauthorized: false } }),
});

export const db = drizzle(pool, { schema });

export * from "./schema";
