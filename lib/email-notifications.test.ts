import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  backupStatus,
  transactions,
  users,
  workspaceMemberships,
  workspaces,
} from "@/db/schema";
import { reportBackupSuccess } from "@/lib/backup-status";
import * as notificationsService from "@/lib/db/notifications";
import * as paymentLogService from "@/lib/db/outgoing-payment-logs";
import * as recurringMoneyService from "@/lib/db/recurring-outgoings";
import * as transactionsService from "@/lib/db/transactions";
import { getCurrentUtcDate } from "@/lib/outgoings-date";
import {
  EmailConfigurationError,
  dispatchEmailNotifications,
  getEmailNotificationStatus,
  setEmailNotifications,
} from "./email-notifications";

const originalEnvironment = {
  smtpUrl: process.env.SMTP_URL,
  smtpFrom: process.env.SMTP_FROM,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  backupToken: process.env.BACKUP_REPORT_TOKEN,
};

afterEach(() => {
  for (const [name, value] of Object.entries({
    SMTP_URL: originalEnvironment.smtpUrl,
    SMTP_FROM: originalEnvironment.smtpFrom,
    NEXT_PUBLIC_SITE_URL: originalEnvironment.siteUrl,
    BACKUP_REPORT_TOKEN: originalEnvironment.backupToken,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("SMTP notification configuration", () => {
  it("rejects missing or invalid SMTP configuration without exposing credentials", async () => {
    process.env.SMTP_URL = "https://user:secret@example.com";
    process.env.SMTP_FROM = "Sika <sika@example.com>";
    process.env.NEXT_PUBLIC_SITE_URL = "https://sika.example";
    await assert.rejects(
      () => dispatchEmailNotifications(),
      (error: unknown) => {
        assert.ok(error instanceof EmailConfigurationError);
        assert.equal(error.message.includes("secret"), false);
        return true;
      },
    );
  });
});

describe(
  "SMTP notification delivery",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("sends one workspace digest and deduplicates each unread occurrence", async () => {
      process.env.SMTP_URL = "smtp://mailer:secret@mail.example.com:587";
      process.env.SMTP_FROM = "Sika <sika@example.com>";
      process.env.NEXT_PUBLIC_SITE_URL = "https://sika.example";

      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      const email = `email-${userId.slice(0, 8)}@example.com`;
      const today = getCurrentUtcDate();
      const dueDay = Number(today.slice(8, 10));
      const shiftedDate = (months: number) => {
        const [year, month] = today.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
        return new Date(Date.UTC(year, month - 1 + months, Math.min(dueDay, lastDay)))
          .toISOString()
          .slice(0, 10);
      };
      const nextMonth = shiftedDate(1);
      const retryMonth = shiftedDate(2);

      await db.insert(users).values({
        id: userId,
        name: "Email test user",
        email,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Personal & home",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Other workspace",
          type: "business",
          currency: "USD",
          isDefault: false,
        },
      ]);
      await db.insert(workspaceMemberships).values([
        { workspaceId, userId, role: "owner" },
        { workspaceId: otherWorkspaceId, userId, role: "owner" },
      ]);

      try {
        const dueSchedule = await recurringMoneyService.create(userId, workspaceId, {
          name: "Rent <urgent>",
          amount: 900,
          type: "expense",
          dayOfMonth: dueDay,
        });
        const settled = await recurringMoneyService.create(userId, workspaceId, {
          name: "Already settled",
          amount: 40,
          type: "expense",
          dayOfMonth: dueDay,
        });
        await paymentLogService.create(
          userId,
          settled.id,
          { amount: 40, paidAt: today, periodMonth: `${today.slice(0, 7)}-01` },
          workspaceId,
        );

        assert.deepEqual(await getEmailNotificationStatus(userId, workspaceId), {
          configured: true,
          enabled: false,
          email,
        });
        await setEmailNotifications(userId, workspaceId, true);
        assert.equal((await getEmailNotificationStatus(userId, workspaceId)).enabled, true);
        assert.equal(
          (await getEmailNotificationStatus(userId, otherWorkspaceId)).enabled,
          false,
          "email opt-in must remain workspace-scoped",
        );

        const messages: Array<{ to: string; subject: string; text: string; html: string }> = [];
        const send = async (message: (typeof messages)[number]) => {
          messages.push(message);
        };
        const first = await dispatchEmailNotifications({ today, send });
        assert.equal(first.sent, 1);
        assert.equal(first.emails, 1, "due items for one workspace are sent as one digest");
        assert.equal(messages[0].to, email, "delivery always uses the account email");
        assert.match(messages[0].text, /£900\.00/);
        assert.match(messages[0].text, /https:\/\/sika\.example\/dashboard\/outgoings/);
        assert.equal(messages[0].text.includes("Already settled"), false);
        assert.match(messages[0].html, /Rent &lt;urgent&gt;/);
        assert.match(messages[0].html, /Personal &amp; home/);
        assert.equal(JSON.stringify(first).includes("secret"), false);

        const repeat = await dispatchEmailNotifications({ today, send });
        assert.equal(repeat.sent, 0);
        assert.equal(repeat.skipped, 1);
        assert.equal(messages.length, 1);

        const dueNotification = (await notificationsService.listDue(userId, workspaceId, today))
          .find((notification) => notification.title === dueSchedule.name)!;
        await notificationsService.markRead(userId, workspaceId, dueNotification.id, true);
        assert.equal((await dispatchEmailNotifications({ today, send })).notifications, 0);

        const nextOccurrence = await dispatchEmailNotifications({ today: nextMonth, send });
        assert.equal(nextOccurrence.sent, 2, "a new month has distinct stable occurrence keys");
        assert.equal(nextOccurrence.emails, 1);

        await setEmailNotifications(userId, workspaceId, false);
        assert.equal((await dispatchEmailNotifications({ today: retryMonth, send })).workspaces, 0);

        await setEmailNotifications(userId, workspaceId, true);
        const failed = await dispatchEmailNotifications({
          today: retryMonth,
          send: async () => {
            throw new Error("SMTP temporarily unavailable");
          },
        });
        assert.equal(failed.failed, 2);
        assert.equal((await getEmailNotificationStatus(userId, workspaceId)).enabled, true);
        const retried = await dispatchEmailNotifications({ today: retryMonth, send });
        assert.equal(retried.sent, 2, "failed SMTP sends release occurrence claims for retry");

        const reviewable = await transactionsService.create(userId, workspaceId, {
          amount: 23,
          date: retryMonth,
          type: "expense",
          category: "Uncategorized",
          payee: "Review this import",
        });
        const secondReviewable = await transactionsService.create(userId, workspaceId, {
          amount: 19,
          date: retryMonth,
          type: "expense",
          category: "Uncategorized",
          payee: "Review this import too",
        });
        await db
          .update(transactions)
          .set({ needsReview: true })
          .where(inArray(transactions.id, [reviewable.id, secondReviewable.id]));
        const reviewRun = await dispatchEmailNotifications({ today: retryMonth, send });
        assert.equal(reviewRun.sent, 2, "review items use the same SMTP digest pipeline");
        assert.match(messages.at(-1)!.text, /Review imported transaction/);
        assert.match(messages.at(-1)!.text, /needsReview=true/);

        process.env.BACKUP_REPORT_TOKEN = "email-backup-secret";
        await reportBackupSuccess(new Date("2020-01-01T00:00:00Z"));
        const backupRun = await dispatchEmailNotifications({ today: retryMonth, send });
        assert.equal(backupRun.sent, 1, "stale backups use the same SMTP pipeline");
        assert.match(messages.at(-1)!.text, /Database backup is stale/);
        assert.equal(messages.at(-1)!.text.includes("£0.00"), false);
      } finally {
        await db.delete(backupStatus);
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
