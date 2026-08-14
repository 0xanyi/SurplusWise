/* global process, console, fetch, AbortSignal */

import { chmod, mkdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import {
  flagValue,
  postgresConnection,
  runCommand,
  validateBackupArchive,
} from "./backup-tools.mjs";

function defaultBackupPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve("backups", `sika-${timestamp}.dump`);
}

async function reportSuccess() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const token = process.env.BACKUP_REPORT_TOKEN;
  if (!siteUrl && !token) return;
  if (!siteUrl || !token) {
    throw new Error(
      "Both NEXT_PUBLIC_SITE_URL and BACKUP_REPORT_TOKEN are required to report backup success",
    );
  }
  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/api/backup-status/report`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Backup status report failed with HTTP ${response.status}`);
  console.log("[backup] Reported validated success to Sika.");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const args = process.argv.slice(2);
  const outputPath = resolve(flagValue(args, "--output") ?? defaultBackupPath());
  const force = args.includes("--force");
  if (!force && (await stat(outputPath).catch(() => null))) {
    throw new Error(`Backup already exists: ${outputPath}. Use --force to replace it.`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const partialPath = resolve(dirname(outputPath), `.${basename(outputPath)}.${process.pid}.partial`);
  await rm(partialPath, { force: true });
  const pgDump = process.env.PG_DUMP_BIN || "pg_dump";
  const { env } = postgresConnection(process.env.DATABASE_URL);

  try {
    console.log(`[backup] Creating ${outputPath}...`);
    await runCommand(
      pgDump,
      ["--format=custom", "--no-owner", "--no-privileges", "--file", partialPath],
      { env },
    );
    await chmod(partialPath, 0o600);
    const result = await validateBackupArchive(partialPath);
    await rename(partialPath, outputPath);
    console.log(`[backup] Validated ${outputPath} (${result.sizeBytes} bytes).`);
    await reportSuccess();
  } catch (error) {
    await rm(partialPath, { force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error("[backup] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
