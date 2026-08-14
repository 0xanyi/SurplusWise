import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions, users, workspaces } from "@/db/schema";
import * as notificationsService from "./notifications";
import * as budgetsService from "./budgets";
import * as recurringMoneyService from "./recurring-outgoings";
import * as draftsService from "./recurring-money-drafts";
import * as transactionsService from "./transactions";

describe(
  "current notifications regression",
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

    it("derives review notifications from live workspace-scoped import state", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Review notification user",
        email: `review-notifications-${userId.slice(0, 8)}@example.com`,
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
          type: "business",
          currency: "GBP",
          isDefault: false,
        },
      ]);

      try {
        const reviewable = await transactionsService.create(userId, workspaceId, {
          amount: 27.5,
          date: "2028-02-10",
          type: "expense",
          category: "Uncategorized",
          payee: "Corner Shop",
        });
        const other = await transactionsService.create(userId, otherWorkspaceId, {
          amount: 50,
          date: "2028-02-10",
          type: "expense",
          category: "Uncategorized",
          payee: "Other workspace payee",
        });
        await db
          .update(transactions)
          .set({ needsReview: true })
          .where(inArray(transactions.id, [reviewable.id, other.id]));

        let reviewItems = await notificationsService.listReviewItems(userId, workspaceId);
        assert.equal(reviewItems.length, 1);
        assert.deepEqual(reviewItems[0], {
          id: `transaction-review:${reviewable.id}`,
          kind: "review_item",
          date: "2028-02-10",
          title: "Review imported transaction",
          description: "Corner Shop needs classification review",
          amount: 27.5,
          type: "expense",
          daysUntilDue: null,
          href: "/dashboard/transactions?needsReview=true",
          readAt: null,
        });

        await notificationsService.markRead(userId, workspaceId, reviewItems[0].id, true);
        reviewItems = await notificationsService.listReviewItems(userId, workspaceId);
        assert.ok(reviewItems[0].readAt instanceof Date);
        assert.equal(
          (await notificationsService.listReviewItems(userId, otherWorkspaceId))[0].readAt,
          null,
          "read state must not cross workspace boundaries",
        );

        await transactionsService.bulkUpdateMetadata(userId, workspaceId, {
          ids: [reviewable.id],
          needsReview: false,
        });
        assert.equal(
          (await notificationsService.listReviewItems(userId, workspaceId)).length,
          0,
          "reviewed transactions disappear without separate notification cleanup",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("derives current budget threshold notifications without mixing workspace spending", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Budget notification user",
        email: `budget-notifications-${userId.slice(0, 8)}@example.com`,
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
          name: "Business",
          type: "business",
          currency: "GBP",
          isDefault: false,
        },
      ]);

      try {
        const budget = await budgetsService.create(userId, workspaceId, {
          category: "Food",
          amount: 100,
          period: "monthly",
          startDate: "2028-02-01",
          endDate: "2028-02-29",
          type: "expense",
        });
        await transactionsService.create(userId, workspaceId, {
          amount: 85,
          date: "2028-02-05",
          type: "expense",
          category: "Food",
        });
        await transactionsService.create(userId, otherWorkspaceId, {
          amount: 1000,
          date: "2028-02-05",
          type: "expense",
          category: "Food",
        });

        let limits = await notificationsService.listBudgetLimits(
          userId,
          workspaceId,
          "2028-02-10",
        );
        assert.deepEqual(limits, [{
          id: `budget-limit:${budget.id}:warning`,
          kind: "budget_limit",
          date: "2028-02-29",
          title: "Food budget is near its limit",
          description: "85% of budget used",
          amount: 100,
          type: "expense",
          daysUntilDue: null,
          href: "/dashboard/settings#budgets",
          readAt: null,
        }]);

        await notificationsService.markRead(userId, workspaceId, limits[0].id, true);
        await transactionsService.create(userId, workspaceId, {
          amount: 20,
          date: "2028-02-06",
          type: "expense",
          category: "Food",
        });
        limits = await notificationsService.listBudgetLimits(userId, workspaceId, "2028-02-10");
        assert.equal(limits[0].id, `budget-limit:${budget.id}:exceeded`);
        assert.equal(limits[0].description, "105% of budget used");
        assert.equal(limits[0].readAt, null, "exceeding is a new alert after a read warning");
        assert.equal(
          (await notificationsService.listBudgetLimits(userId, workspaceId, "2028-03-01")).length,
          0,
          "expired budget periods are not current alerts",
        );

        await budgetsService.update(userId, budget.id, { isActive: false });
        assert.equal(
          (await notificationsService.listBudgetLimits(userId, workspaceId, "2028-02-10")).length,
          0,
          "inactive budgets disappear without separate notification cleanup",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
