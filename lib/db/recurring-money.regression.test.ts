import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as analyticsService from "./analytics";
import * as clientsService from "./clients";
import * as givingRecipientsService from "./giving-recipients";
import * as draftsService from "./recurring-money-drafts";
import * as recurringMoneyService from "./recurring-outgoings";
import * as transactionsService from "./transactions";

describe(
  "recurring money foundation regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("preserves expenses and scopes income and giving attribution", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Recurring money test user",
        email: `recurring-money-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        { id: workspaceId, userId, name: "Personal", type: "personal", currency: "GBP", isDefault: true },
        { id: otherWorkspaceId, userId, name: "Other", type: "personal", currency: "GBP", isDefault: false },
      ]);

      try {
        const client = await clientsService.create(workspaceId, { name: "Example client" });
        const recipient = await givingRecipientsService.createRecipient(workspaceId, {
          name: "Community Church",
        });
        const designation = await givingRecipientsService.createDesignation(workspaceId,
          { recipientId: recipient.id, name: "Building fund" },
        );
        const otherRecipient = await givingRecipientsService.createRecipient(
          otherWorkspaceId,
          { name: "Other recipient" },
        );
        const secondRecipient = await givingRecipientsService.createRecipient(
          workspaceId,
          { name: "Second recipient" },
        );

        const expense = await recurringMoneyService.create(workspaceId, {
          name: "Hosting",
          amount: 20,
          dayOfMonth: 1,
          clientId: client.id,
          rebillMode: "at_cost",
        });
        assert.equal(expense.type, "expense", "legacy create calls default to expenses");
        const settledExpense = await recurringMoneyService.create(workspaceId, {
          name: "Rent",
          amount: 800,
          dayOfMonth: 1,
        });
        await recurringMoneyService.settle(workspaceId, settledExpense.id, {
          amount: 800,
          paidAt: "2026-08-01",
          periodMonth: "2026-08-01",
        });
        const income = await recurringMoneyService.create(workspaceId, {
          name: "Salary",
          amount: 2000,
          type: "income",
          dayOfMonth: 25,
        });
        const giving = await recurringMoneyService.create(workspaceId, {
          name: "Monthly gift",
          amount: 100,
          type: "giving",
          dayOfMonth: 5,
          givingRecipientId: recipient.id,
          givingDesignationId: designation.id,
        });

        assert.deepEqual(
          (await recurringMoneyService.list(workspaceId, undefined, "expense")).map(
            (row) => row.id,
          ).sort(),
          [expense.id, settledExpense.id].sort(),
        );
        assert.deepEqual(
          (await recurringMoneyService.list(workspaceId)).map((row) => row.id).sort(),
          [expense.id, settledExpense.id, income.id, giving.id].sort(),
        );
        const givingRow = (await recurringMoneyService.list(
          workspaceId,
          undefined,
          "giving",
        ))[0];
        assert.equal(givingRow?.givingRecipientName, "Community Church");
        assert.equal(givingRow?.givingDesignationName, "Building fund");

        await assert.rejects(
          () => recurringMoneyService.update(workspaceId, settledExpense.id, { type: "income" }),
          /Unmatch this Recurring money from its Transactions/,
        );
        await assert.rejects(
          () => recurringMoneyService.create(workspaceId, {
            name: "Invalid income",
            amount: 10,
            type: "income",
            dayOfMonth: 1,
            clientId: client.id,
          }),
          /Clients can only be assigned to recurring expenses/,
        );
        await assert.rejects(
          () => recurringMoneyService.create(workspaceId, {
            name: "Cross-workspace gift",
            amount: 10,
            type: "giving",
            dayOfMonth: 1,
            givingRecipientId: otherRecipient.id,
          }),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.create(workspaceId, {
            name: "Mismatched fund",
            amount: 10,
            type: "giving",
            dayOfMonth: 1,
            givingRecipientId: secondRecipient.id,
            givingDesignationId: designation.id,
          }),
          /Giving designation not found for this recipient/,
        );
        await assert.rejects(
          () => recurringMoneyService.update(workspaceId, expense.id, { type: "income" }),
          /Only recurring expenses can use client recovery terms/,
        );
        await recurringMoneyService.update(workspaceId, expense.id, {
          type: "income",
          clientId: null,
          rebillMode: "none",
          rebillAmount: null,
        });
        await assert.rejects(
          () => recurringMoneyService.update(otherWorkspaceId, income.id, { amount: 2100 }),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.update(workspaceId, income.id, { amount: 2200 }, "expense"),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.remove(workspaceId, income.id, "expense"),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.remove(otherWorkspaceId, income.id),
          /not found or unauthorized/,
        );
        const rent = (await draftsService.listOccurrences(workspaceId, "2026-08-01")).find(
          (row) => row.recurringMoneyId === settledExpense.id,
        );
        assert.equal(rent?.status, "settled");
        assert.equal(rent?.recordedAmount, 800);
        await assert.rejects(
          () => recurringMoneyService.unsettle(otherWorkspaceId, settledExpense.id, "2026-08-01"),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.update(workspaceId, giving.id, { type: "income" }),
          /Giving attribution can only be assigned to recurring giving/,
        );
        const formerGiving = await recurringMoneyService.update(workspaceId, giving.id, {
          type: "income",
          givingRecipientId: null,
          givingDesignationId: null,
        });
        assert.equal(formerGiving.type, "income");
        assert.equal(formerGiving.givingRecipientId, null);
        assert.equal(formerGiving.givingDesignationId, null);

        const analytics = await analyticsService.getAnalytics(workspaceId, "custom", {
          startDate: "2026-08-01",
          endDate: "2026-08-31",
        });
        assert.equal(
          analytics.safeToSpendBreakdown.committedExpenses,
          800,
          "recurring income and giving must not be counted as committed expenses",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("caps mark-paid to remaining outstanding in one write", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Settlement cap test user",
        email: `settlement-cap-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values({
        id: workspaceId,
        userId,
        name: "Personal",
        type: "personal",
        currency: "GBP",
        isDefault: true,
      });

      try {
        const bill = await recurringMoneyService.create(workspaceId, {
          name: "Electricity",
          amount: 100,
          dayOfMonth: 10,
        });
        await draftsService.generate(workspaceId, "2026-08-01");
        const draft = (await draftsService.list(workspaceId, "2026-08-01")).find(
          (row) => row.recurringMoneyId === bill.id,
        );
        assert.ok(draft);
        const partial = await transactionsService.create(workspaceId, {
          amount: 40,
          date: "2026-08-10",
          type: "expense",
          category: "Utilities",
        });
        await draftsService.matchTransaction(workspaceId, draft.id, partial.id);

        await recurringMoneyService.settle(workspaceId, bill.id, {
          amount: 100,
          paidAt: "2026-08-12",
          periodMonth: "2026-08-01",
        });
        const occurrence = (await draftsService.listOccurrences(workspaceId, "2026-08-01")).find(
          (row) => row.recurringMoneyId === bill.id,
        );
        assert.equal(occurrence?.status, "settled");
        assert.equal(occurrence?.recordedAmount, 100);
        assert.equal(occurrence?.outstandingAmount, 0);
        assert.equal((await transactionsService.list(workspaceId)).length, 2);

        await assert.rejects(
          () =>
            recurringMoneyService.settle(workspaceId, bill.id, {
              paidAt: "2026-08-13",
              periodMonth: "2026-08-01",
            }),
          /already settled/,
        );
        assert.equal((await transactionsService.list(workspaceId)).length, 2);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
