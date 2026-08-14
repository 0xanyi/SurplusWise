import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { backupStatus } from "@/db/schema";
import { POST as reportRoute } from "@/app/api/backup-status/report/route";
import {
  getBackupStatus,
  reportBackupSuccess,
  validBackupReportToken,
} from "./backup-status";

afterEach(async () => {
  delete process.env.BACKUP_REPORT_TOKEN;
  if (process.env.DATABASE_URL) await db.delete(backupStatus);
});

describe("backup status", { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" }, () => {
  it("fails closed and records only server-timestamped successful reports", async () => {
    process.env.BACKUP_REPORT_TOKEN = "backup-report-secret";
    assert.equal(validBackupReportToken("backup-report-secret"), true);
    assert.equal(validBackupReportToken("wrong-secret"), false);
    assert.equal(validBackupReportToken(null), false);

    const unauthorized = await reportRoute(new NextRequest("https://sika.test/api/backup-status/report", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    }));
    assert.equal(unauthorized.status, 401);
    assert.equal((await getBackupStatus()).lastSuccessfulAt, null);

    const firstSuccess = new Date("2025-02-10T12:00:00.000Z");
    await reportBackupSuccess(firstSuccess);
    assert.deepEqual(await getBackupStatus(), {
      configured: true,
      lastSuccessfulAt: firstSuccess,
    });

    const requestStartedAt = Date.now();
    const authorized = await reportRoute(new NextRequest("https://sika.test/api/backup-status/report", {
      method: "POST",
      headers: { authorization: "Bearer backup-report-secret" },
    }));
    assert.equal(authorized.status, 200);
    const reportedAt = new Date((await authorized.json()).last_successful_at);
    assert.ok(reportedAt.getTime() >= requestStartedAt);
  });
});
