import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db/client";
import {
  backupStatus,
  pushSubscriptions,
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
import { POST as dispatchRoute } from "@/app/api/notifications/dispatch/route";
import {
  PushConfigurationError,
  PushSubscriptionConflictError,
  dispatchPushNotifications,
  getSubscriptionStatus,
  subscribe,
  unsubscribe,
  validDispatchToken,
} from "./push-notifications";

const originalEnvironment = {
  publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
  privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
  subject: process.env.WEB_PUSH_VAPID_SUBJECT,
  token: process.env.NOTIFICATION_DISPATCH_TOKEN,
  backupToken: process.env.BACKUP_REPORT_TOKEN,
};

afterEach(() => {
  for (const [name, value] of Object.entries({
    WEB_PUSH_VAPID_PUBLIC_KEY: originalEnvironment.publicKey,
    WEB_PUSH_VAPID_PRIVATE_KEY: originalEnvironment.privateKey,
    WEB_PUSH_VAPID_SUBJECT: originalEnvironment.subject,
    NOTIFICATION_DISPATCH_TOKEN: originalEnvironment.token,
    BACKUP_REPORT_TOKEN: originalEnvironment.backupToken,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Web Push configuration", () => {
  it("uses a non-empty dispatch token without exposing it", () => {
    process.env.NOTIFICATION_DISPATCH_TOKEN = "correct-secret";
    assert.equal(validDispatchToken("correct-secret"), true);
    assert.equal(validDispatchToken("wrong-secret"), false);
    assert.equal(validDispatchToken(null), false);
    delete process.env.NOTIFICATION_DISPATCH_TOKEN;
    assert.equal(validDispatchToken("correct-secret"), false);
  });

  it("rejects an invalid dispatch bearer token", async () => {
    process.env.NOTIFICATION_DISPATCH_TOKEN = "correct-secret";
    const response = await dispatchRoute(new NextRequest("https://sika.example/api/notifications/dispatch", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  });

  it("fails safely when delivery credentials are incomplete", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "public";
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.WEB_PUSH_VAPID_SUBJECT;
    await assert.rejects(() => dispatchPushNotifications(), PushConfigurationError);
  });
});

describe(
  "Web Push persistence and dispatch",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("keeps opt-in workspace-scoped and delivers each current occurrence once per device", async () => {
      process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "public";
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "private";
      process.env.WEB_PUSH_VAPID_SUBJECT = "mailto:test@example.com";

      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
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
      const followingMonth = shiftedDate(2);
      const laterMonth = shiftedDate(3);
      const retryMonth = shiftedDate(4);
      await db.insert(users).values({
        id: userId,
        name: "Push test user",
        email: `push-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Push Personal",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Push Other",
          type: "business",
          currency: "GBP",
          isDefault: false,
        },
      ]);
      await db.insert(workspaceMemberships).values([
        { workspaceId, userId, role: "owner" },
        { workspaceId: otherWorkspaceId, userId, role: "owner" },
      ]);

      const first = {
        endpoint: "https://push.example.test/device-one",
        keys: { p256dh: "p256dh-one", auth: "auth-one" },
      };
      const second = {
        endpoint: "https://push.example.test/device-two",
        keys: { p256dh: "p256dh-two", auth: "auth-two" },
      };

      try {
        const salary = await recurringMoneyService.create(userId, workspaceId, {
          name: "Monthly salary",
          amount: 1000,
          type: "income",
          dayOfMonth: dueDay,
        });
        const settled = await recurringMoneyService.create(userId, workspaceId, {
          name: "Already paid bill",
          amount: 75,
          type: "expense",
          dayOfMonth: dueDay,
        });
        await paymentLogService.create(
          userId,
          settled.id,
          { amount: 75, paidAt: today, periodMonth: `${today.slice(0, 7)}-01` },
          workspaceId,
        );

        await subscribe(userId, workspaceId, first);
        await subscribe(userId, workspaceId, {
          ...first,
          keys: { p256dh: "refreshed-key", auth: "refreshed-auth" },
        });
        await subscribe(userId, workspaceId, second);

        const storedFirst = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, first.endpoint));
        assert.equal(storedFirst.length, 1, "subscription refresh must not duplicate an endpoint");
        assert.equal(storedFirst[0].p256dh, "refreshed-key");
        assert.deepEqual(await getSubscriptionStatus(userId, workspaceId, first.endpoint), {
          configured: true,
          publicKey: "public",
          enabled: true,
          deviceEnabled: true,
        });
        assert.equal(
          (await getSubscriptionStatus(userId, otherWorkspaceId, first.endpoint)).deviceEnabled,
          false,
          "another workspace must not claim this device",
        );
        await subscribe(userId, otherWorkspaceId, first);
        assert.equal(
          (await getSubscriptionStatus(userId, workspaceId, first.endpoint)).deviceEnabled,
          true,
          "the same browser can opt into two workspaces without reassignment",
        );
        assert.equal(
          (await getSubscriptionStatus(userId, otherWorkspaceId, first.endpoint)).deviceEnabled,
          true,
        );
        await unsubscribe(userId, otherWorkspaceId, first.endpoint);

        const payloads: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
        const send = async (subscription: { endpoint: string }, payload: string) => {
          payloads.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
        };
        const firstRun = await dispatchPushNotifications({ today, send });
        assert.equal(firstRun.sent, 2, "each enabled device receives the occurrence once");
        assert.equal(firstRun.notifications, 1, "settled items are not due");
        assert.equal(payloads.every(({ payload }) => payload.title === "Monthly salary"), true);
        assert.equal(JSON.stringify(firstRun).includes("private"), false, "summary must not contain secrets");

        const repeat = await dispatchPushNotifications({ today, send });
        assert.equal(repeat.sent, 0);
        assert.equal(repeat.skipped, 2, "repeated dispatch is deduplicated per device");

        const salaryNotification = (await notificationsService.listDue(userId, workspaceId, today))
          .find((notification) => notification.title === salary.name)!;
        await notificationsService.markRead(userId, workspaceId, salaryNotification.id, true);
        const readRun = await dispatchPushNotifications({ today, send });
        assert.equal(readRun.notifications, 0, "read in-app occurrences are not pushed");

        const nextMonthRun = await dispatchPushNotifications({ today: nextMonth, send });
        assert.equal(nextMonthRun.sent, 4, "new monthly occurrences have new stable event keys");

        await unsubscribe(userId, workspaceId, first.endpoint);
        const disabled = await dispatchPushNotifications({ today: followingMonth, send });
        assert.equal(disabled.subscriptions, 0, "workspace opt-out disables all of its devices");
        assert.equal(
          (await getSubscriptionStatus(userId, workspaceId, first.endpoint)).enabled,
          false,
        );

        await subscribe(userId, workspaceId, first);
        await subscribe(userId, workspaceId, second);
        const permanentFailure = Object.assign(new Error("Gone"), { statusCode: 410 });
        let failedEndpoint: string | null = null;
        const staleRun = await dispatchPushNotifications({
          today: followingMonth,
          send: async (subscription, payload) => {
            if (!failedEndpoint) {
              failedEndpoint = subscription.endpoint;
              throw permanentFailure;
            }
            await send(subscription, payload);
          },
        });
        assert.equal(staleRun.disabled, 1);
        const [stale] = await db
          .select({ enabled: pushSubscriptions.enabled })
          .from(pushSubscriptions)
          .where(
            and(
              eq(pushSubscriptions.endpoint, failedEndpoint!),
              eq(pushSubscriptions.workspaceId, workspaceId),
            ),
          );
        assert.equal(stale.enabled, false, "410 disables the stale browser subscription");

        const notFoundRun = await dispatchPushNotifications({
          today: laterMonth,
          send: async () => {
            throw Object.assign(new Error("Not found"), { statusCode: 404 });
          },
        });
        assert.equal(notFoundRun.disabled, 1, "404 also disables a stale subscription");

        await subscribe(userId, workspaceId, first);
        const transient = await dispatchPushNotifications({
          today: retryMonth,
          send: async () => {
            throw Object.assign(new Error("Push service unavailable"), { statusCode: 503 });
          },
        });
        assert.equal(transient.failed, 1);
        assert.equal(
          (await getSubscriptionStatus(userId, workspaceId, first.endpoint)).deviceEnabled,
          true,
          "transient failures retain the subscription",
        );
        const retried = await dispatchPushNotifications({ today: retryMonth, send });
        assert.equal(retried.sent, 2, "transient failures release claims for a later retry");

        const reviewable = await transactionsService.create(userId, workspaceId, {
          amount: 18,
          date: retryMonth,
          type: "expense",
          category: "Uncategorized",
          payee: "Review me",
        });
        const secondReviewable = await transactionsService.create(userId, workspaceId, {
          amount: 12,
          date: retryMonth,
          type: "expense",
          category: "Uncategorized",
          payee: "Review me too",
        });
        await db
          .update(transactions)
          .set({ needsReview: true })
          .where(inArray(transactions.id, [reviewable.id, secondReviewable.id]));
        const payloadCount = payloads.length;
        const reviewRun = await dispatchPushNotifications({ today: retryMonth, send });
        assert.equal(reviewRun.sent, 2, "each review item receives a durable delivery claim");
        assert.equal(payloads.length, payloadCount + 1, "review items are grouped into one push");
        assert.equal(payloads.at(-1)?.payload.title, "2 imported transactions need review");
        assert.equal(
          payloads.at(-1)?.payload.href,
          "/dashboard/transactions?needsReview=true",
        );

        process.env.BACKUP_REPORT_TOKEN = "push-backup-secret";
        await reportBackupSuccess(new Date("2020-01-01T00:00:00Z"));
        const backupRun = await dispatchPushNotifications({ today: retryMonth, send });
        assert.equal(backupRun.sent, 1, "stale backups use the same push pipeline");
        assert.equal(payloads.at(-1)?.payload.title, "Database backup is stale");
        assert.equal(payloads.at(-1)?.payload.href, "/dashboard/settings#data-resilience");
      } finally {
        await db.delete(backupStatus);
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("does not let one member claim another member's browser endpoint", async () => {
      process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "public";
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "private";
      process.env.WEB_PUSH_VAPID_SUBJECT = "mailto:test@example.com";

      const ownerId = crypto.randomUUID();
      const memberId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const endpoint = `https://push.example.test/${crypto.randomUUID()}`;
      await db.insert(users).values([
        { id: ownerId, name: "Push owner", email: `push-owner-${ownerId}@example.com` },
        { id: memberId, name: "Push member", email: `push-member-${memberId}@example.com` },
      ]);
      await db.insert(workspaces).values({
        id: workspaceId,
        userId: ownerId,
        name: "Shared push workspace",
        type: "personal",
        currency: "GBP",
        isDefault: true,
      });
      await db.insert(workspaceMemberships).values({
        workspaceId,
        userId: memberId,
        role: "viewer",
      });

      try {
        await subscribe(ownerId, workspaceId, {
          endpoint,
          keys: { p256dh: "owner-key", auth: "owner-auth" },
        });
        await subscribe(ownerId, workspaceId, {
          endpoint,
          keys: { p256dh: "refreshed-owner-key", auth: "refreshed-owner-auth" },
        });

        await assert.rejects(
          subscribe(memberId, workspaceId, {
            endpoint,
            keys: { p256dh: "member-key", auth: "member-auth" },
          }),
          PushSubscriptionConflictError,
        );

        const [saved] = await db
          .select({ userId: pushSubscriptions.userId, p256dh: pushSubscriptions.p256dh })
          .from(pushSubscriptions)
          .where(
            and(
              eq(pushSubscriptions.workspaceId, workspaceId),
              eq(pushSubscriptions.endpoint, endpoint),
            ),
          );
        assert.deepEqual(saved, { userId: ownerId, p256dh: "refreshed-owner-key" });
      } finally {
        await db.delete(users).where(inArray(users.id, [ownerId, memberId]));
      }
    });
  },
);
