import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertArchiveToc,
  flagValue,
  postgresConnection,
  positionalArgument,
  REQUIRED_BACKUP_TABLES,
} from "@/scripts/backup-tools.mjs";

describe("backup command safety", () => {
  it("accepts only archives containing every current table and the migration journal", () => {
    const toc = [
      ...REQUIRED_BACKUP_TABLES.map(
        (table, index) => `${index + 1}; 1259 ${index + 10} TABLE public ${table} sika`,
      ),
      "999; 1259 999 TABLE drizzle __drizzle_migrations sika",
    ].join("\n");
    assert.doesNotThrow(() => assertArchiveToc(toc));
    assert.throws(
      () => assertArchiveToc(toc.replace("TABLE public transactions", "TABLE public missing")),
      /missing required tables: transactions/i,
    );
    assert.throws(
      () => assertArchiveToc(toc.replace("__drizzle_migrations", "missing_journal")),
      /migration journal/i,
    );
  });

  it("passes database credentials through the environment rather than command arguments", () => {
    const connection = postgresConnection(
      "postgresql://backup%40user:secret%2Fvalue@db.example.test:5433/sika_restore?sslmode=require",
    );
    assert.equal(connection.databaseName, "sika_restore");
    assert.equal(connection.env.PGHOST, "db.example.test");
    assert.equal(connection.env.PGPORT, "5433");
    assert.equal(connection.env.PGUSER, "backup@user");
    assert.equal(connection.env.PGPASSWORD, "secret/value");
    assert.equal(connection.env.PGSSLMODE, "require");
  });

  it("parses archive and confirmation arguments without mistaking flag values for files", () => {
    const args = ["backup.dump", "--confirm", "sika_restore"];
    assert.equal(positionalArgument(args, ["--confirm"]), "backup.dump");
    assert.equal(flagValue(args, "--confirm"), "sika_restore");
    assert.throws(() => flagValue(["--confirm"], "--confirm"), /requires a value/);
  });
});
