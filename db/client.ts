import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const isBuildPhase =
  process.env.npm_lifecycle_event === "build" ||
  process.env.NEXT_PHASE === "phase-production-build";

if (!process.env.DATABASE_URL && !isBuildPhase) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (see .env.example).",
  );
}

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";

// Hot-reload-safe: reuse a single Pool across Next.js dev fast-refreshes.
const globalForDb = globalThis as unknown as { _pgPool?: pg.Pool };
const pool = globalForDb._pgPool ?? new pg.Pool({
  connectionString,
});
if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

export const db = drizzle(pool, { schema });
