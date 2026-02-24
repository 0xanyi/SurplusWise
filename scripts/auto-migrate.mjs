/* global process, console, setTimeout */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Client } from "pg";

const LOCK_ID = 48201927;
const RETRIES = Number(process.env.DB_MIGRATE_RETRIES ?? "20");
const RETRY_DELAY_MS = Number(process.env.DB_MIGRATE_RETRY_DELAY_MS ?? "2000");

if (process.env.SKIP_DB_AUTO_MIGRATE === "true") {
  console.log("[db-migrate] SKIP_DB_AUTO_MIGRATE=true, skipping auto migration.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("[db-migrate] DATABASE_URL is not set. Refusing to start.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry() {
  let lastError;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      console.log(`[db-migrate] Connected to database on attempt ${attempt}/${RETRIES}.`);
      return client;
    } catch (error) {
      lastError = error;
      console.warn(`[db-migrate] DB connection attempt ${attempt}/${RETRIES} failed.`);
      try {
        await client.end();
      } catch {
        // ignore close errors
      }
      if (attempt < RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

function runDrizzleCommand(command) {
  return new Promise((resolve, reject) => {
    const bin = "./node_modules/.bin/drizzle-kit";

    if (!existsSync(bin)) {
      reject(new Error("drizzle-kit binary not found in container."));
      return;
    }

    const child = spawn(bin, [command, "--config=drizzle.config.ts"], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`drizzle-kit ${command} exited with code ${code}`));
      }
    });
  });
}

/**
 * Minimal schema check: verify a few key tables exist.
 * Returns list of missing tables (empty = all good).
 */
async function quickSchemaCheck(client) {
  const SPOT_CHECK_TABLES = [
    "users",
    "transactions",
    "recurring_outgoings",
    "debts_credits",
    "loans_given",
    "investments",
  ];

  const result = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [SPOT_CHECK_TABLES],
  );

  const found = new Set(result.rows.map((r) => r.table_name));
  return SPOT_CHECK_TABLES.filter((t) => !found.has(t));
}

async function main() {
  let client;
  try {
    client = await connectWithRetry();

    console.log("[db-migrate] Acquiring advisory lock...");
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);

    try {
      // Step 1: Run drizzle-kit migrate (applies pending migrations)
      console.log("[db-migrate] Running migrations...");
      await runDrizzleCommand("migrate");
      console.log("[db-migrate] Migrations complete.");

      // Step 2: Quick-check if schema is actually present
      const missing = await quickSchemaCheck(client);

      if (missing.length > 0) {
        // Migration journal was out of sync — tables still missing.
        // Fall back to drizzle-kit push to force-sync the schema.
        console.warn(
          `[db-migrate] Migration journal is out of sync — missing tables: ${missing.join(", ")}`,
        );
        console.log("[db-migrate] Falling back to drizzle-kit push to sync schema...");
        await runDrizzleCommand("push");
        console.log("[db-migrate] Schema push complete.");

        // Verify again
        const stillMissing = await quickSchemaCheck(client);
        if (stillMissing.length > 0) {
          throw new Error(
            `Schema still incomplete after push. Missing: ${stillMissing.join(", ")}`,
          );
        }
        console.log("[db-migrate] Schema verified after push.");
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
      console.log("[db-migrate] Advisory lock released.");
    }
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error("[db-migrate] Startup blocked:", error instanceof Error ? error.message : error);
  process.exit(1);
});
