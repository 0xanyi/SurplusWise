import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (see .env.example).",
  );
}

// Hot-reload-safe: reuse a single Pool across Next.js dev fast-refreshes.
const globalForDb = globalThis as unknown as { _pgPool?: pg.Pool };
const pool = globalForDb._pgPool ?? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

export const db = drizzle(pool, { schema });
