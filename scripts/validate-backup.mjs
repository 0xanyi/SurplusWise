/* global process, console */

import { resolve } from "node:path";
import { positionalArgument, validateBackupArchive } from "./backup-tools.mjs";

async function main() {
  const archiveArgument = positionalArgument(process.argv.slice(2));
  if (!archiveArgument) {
    throw new Error("Usage: npm run backup:validate -- <backup.dump>");
  }
  const archivePath = resolve(archiveArgument);
  const result = await validateBackupArchive(archivePath);
  console.log(`[backup] Valid PostgreSQL archive: ${archivePath} (${result.sizeBytes} bytes)`);
}

main().catch((error) => {
  console.error("[backup] Validation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
