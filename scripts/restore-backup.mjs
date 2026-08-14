/* global process, console */

import { resolve } from "node:path";
import { Client } from "pg";
import {
  flagValue,
  positionalArgument,
  postgresConnection,
  runCommand,
  validateBackupArchive,
} from "./backup-tools.mjs";

async function assertEmptyDatabase(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT count(*)::int AS count
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
        AND namespace.nspname NOT LIKE 'pg_toast%'
        AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    `);
    if ((result.rows[0]?.count ?? 0) !== 0) {
      throw new Error(
        "Target database is not empty. Restore into a newly created empty database; this command never overwrites an existing installation.",
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const archiveArgument = positionalArgument(args, ["--confirm"]);
  if (!archiveArgument) {
    throw new Error(
      "Usage: RESTORE_DATABASE_URL=postgresql://... npm run backup:restore -- <backup.dump> --confirm <database-name>",
    );
  }
  if (!process.env.RESTORE_DATABASE_URL) {
    throw new Error(
      "RESTORE_DATABASE_URL is not set. It must point to a newly created empty target database.",
    );
  }

  const archivePath = resolve(archiveArgument);
  const connection = postgresConnection(process.env.RESTORE_DATABASE_URL);
  const confirmation = flagValue(args, "--confirm");
  if (confirmation !== connection.databaseName) {
    throw new Error(
      `Refusing restore: pass --confirm ${connection.databaseName} to confirm the target database name`,
    );
  }

  await validateBackupArchive(archivePath);
  await assertEmptyDatabase(process.env.RESTORE_DATABASE_URL);
  console.log(`[restore] Restoring validated archive into empty database ${connection.databaseName}...`);
  const pgRestore = process.env.PG_RESTORE_BIN || "pg_restore";
  await runCommand(
    pgRestore,
    [
      "--dbname",
      connection.databaseName,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--single-transaction",
      archivePath,
    ],
    { env: connection.env },
  );
  await runCommand(process.execPath, [resolve("scripts/verify-db-schema.mjs")], {
    env: { ...process.env, DATABASE_URL: process.env.RESTORE_DATABASE_URL },
  });
  console.log(`[restore] Restore and schema verification passed for ${connection.databaseName}.`);
}

main().catch((error) => {
  console.error("[restore] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
