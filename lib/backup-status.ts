import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { backupStatus } from "@/db/schema";

const DATABASE_BACKUP_ID = "database";

export function backupMonitoringConfigured() {
  return Boolean(process.env.BACKUP_REPORT_TOKEN?.trim());
}

export function validBackupReportToken(supplied: string | null) {
  const configured = process.env.BACKUP_REPORT_TOKEN?.trim();
  if (!configured || !supplied) return false;
  const configuredDigest = createHash("sha256").update(configured).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(configuredDigest, suppliedDigest);
}

export async function getBackupStatus() {
  const [status] = await db
    .select({ lastSuccessfulAt: backupStatus.lastSuccessfulAt })
    .from(backupStatus)
    .where(eq(backupStatus.id, DATABASE_BACKUP_ID))
    .limit(1);
  return {
    configured: backupMonitoringConfigured(),
    lastSuccessfulAt: status?.lastSuccessfulAt ?? null,
  };
}

export async function reportBackupSuccess(now = new Date()) {
  const [status] = await db
    .insert(backupStatus)
    .values({
      id: DATABASE_BACKUP_ID,
      lastSuccessfulAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: backupStatus.id,
      set: { lastSuccessfulAt: now, updatedAt: now },
    })
    .returning({ lastSuccessfulAt: backupStatus.lastSuccessfulAt });
  return status;
}
