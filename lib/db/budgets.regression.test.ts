import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as budgetsService from "./budgets";
import * as transactionsService from "./transactions";

describe(
  "budget copy-forward regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("copies a budget into the next period and archives its history", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();

      await db.insert(users).values({
        id: userId,
        name: "Budget copy test user",
        email: `budget-copy-${userId.slice(0, 8)}@example.com`,
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
        const current = await budgetsService.create(userId, workspaceId, {
          category: "Groceries",
          amount: 425,
          period: "monthly",
          startDate: "2028-01-01",
          endDate: "2028-01-31",
          type: "expense",
        });

        await assert.rejects(
          budgetsService.copyForward(userId, otherWorkspaceId, current.id),
          /not found or unauthorized/,
        );

        const next = await budgetsService.copyForward(userId, workspaceId, current.id);
        assert.equal(next.category, "Groceries");
        assert.equal(next.amount, "425.00");
        assert.equal(next.startDate, "2028-02-01");
        assert.equal(next.endDate, "2028-02-29");
        assert.equal(next.isActive, true);

        const active = await budgetsService.list(userId, workspaceId, true);
        assert.deepEqual(active.map((budget) => budget.id), [next.id]);

        const archived = await budgetsService.list(userId, workspaceId, false);
        assert.deepEqual(archived.map((budget) => budget.id), [current.id]);

        await assert.rejects(
          budgetsService.copyForward(userId, workspaceId, current.id),
          /already been copied forward/,
        );

        const giving = await budgetsService.create(userId, workspaceId, {
          category: "Community",
          amount: 500,
          period: "monthly",
          startDate: "2028-01-01",
          endDate: "2028-01-31",
          type: "giving",
        });
        await transactionsService.create(userId, workspaceId, {
          category: "Community",
          amount: 100,
          date: "2028-01-15",
          type: "giving",
        });
        await transactionsService.create(userId, otherWorkspaceId, {
          category: "Community",
          amount: 300,
          date: "2028-01-15",
          type: "giving",
        });

        const rolled = await budgetsService.copyForward(userId, workspaceId, giving.id, {
          carryRemaining: true,
        });
        assert.equal(rolled.amount, "900.00");

        const income = await budgetsService.create(userId, workspaceId, {
          category: "Salary",
          amount: 2500,
          period: "monthly",
          startDate: "2028-01-01",
          endDate: "2028-01-31",
          type: "income",
        });
        await assert.rejects(
          budgetsService.copyForward(userId, workspaceId, income.id, {
            carryRemaining: true,
          }),
          /only available for expense and giving/,
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
