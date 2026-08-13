import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as notificationsService from "./notifications";
import * as recurringMoneyService from "./recurring-outgoings";
import * as draftsService from "./recurring-money-drafts";

describe(
  "due-money notifications regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("derives live due items and keeps read state workspace-scoped", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Notification test user",
        email: `notifications-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Personal",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Other",
          type: "personal",
          currency: "GBP",
          isDefault: false,
        },
      ]);

      try {
        await recurringMoneyService.create(userId, workspaceId, {
          name: "Salary",
          amount: 1000,
          type: "income",
          dayOfMonth: 10,
        });
        await recurringMoneyService.create(userId, workspaceId, {
          name: "Rent",
          amount: 600,
          type: "expense",
          dayOfMonth: 12,
        });
        await recurringMoneyService.create(userId, workspaceId, {
          name: "Later bill",
          amount: 30,
          type: "expense",
          dayOfMonth: 18,
        });
        await recurringMoneyService.create(userId, otherWorkspaceId, {
          name: "Other workspace bill",
          amount: 20,
          type: "expense",
          dayOfMonth: 11,
        });

        let notifications = await notificationsService.listDue(
          userId,
          workspaceId,
          "2028-02-10",
        );
        assert.deepEqual(
          notifications.map((notification) => notification.title),
          ["Salary", "Rent"],
        );
        assert.equal(notifications[0].description, "Expected income is due today");
        assert.equal(notifications[1].description, "Payment is due in 2 days");
        assert.equal(notifications[0].readAt, null);

        await notificationsService.markRead(
          userId,
          workspaceId,
          notifications[0].id,
          true,
        );
        notifications = await notificationsService.listDue(
          userId,
          workspaceId,
          "2028-02-10",
        );
        assert.ok(notifications[0].readAt instanceof Date);
        assert.equal(
          (await notificationsService.listDue(
            userId,
            otherWorkspaceId,
            "2028-02-10",
          ))[0].readAt,
          null,
        );

        await notificationsService.markRead(
          userId,
          workspaceId,
          notifications[0].id,
          false,
        );
        notifications = await notificationsService.listDue(
          userId,
          workspaceId,
          "2028-02-10",
        );
        assert.equal(notifications[0].readAt, null);

        await recurringMoneyService.create(userId, workspaceId, {
          name: "Month boundary bill",
          amount: 45,
          type: "expense",
          dayOfMonth: 2,
        });
        const projected = (await notificationsService.listDue(
          userId,
          workspaceId,
          "2028-02-26",
        )).find((notification) => notification.date === "2028-03-02")!;
        await notificationsService.markRead(userId, workspaceId, projected.id, true);
        await draftsService.generate(userId, workspaceId, "2028-03-01");
        const materialized = (await notificationsService.listDue(
          userId,
          workspaceId,
          "2028-03-01",
        )).find((notification) => notification.date === "2028-03-02")!;
        assert.equal(materialized.id, projected.id);
        assert.ok(
          materialized.readAt instanceof Date,
          "read state must survive a future projection becoming a monthly draft",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
