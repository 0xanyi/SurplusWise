import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as analyticsService from "./analytics";
import * as clientsService from "./clients";
import * as givingRecipientsService from "./giving-recipients";
import * as paymentLogsService from "./outgoing-payment-logs";
import * as recurringMoneyService from "./recurring-outgoings";

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
        const client = await clientsService.create(userId, workspaceId, { name: "Example client" });
        const recipient = await givingRecipientsService.createRecipient(userId, workspaceId, {
          name: "Community Church",
        });
        const designation = await givingRecipientsService.createDesignation(
          userId,
          workspaceId,
          { recipientId: recipient.id, name: "Building fund" },
        );
        const otherRecipient = await givingRecipientsService.createRecipient(
          userId,
          otherWorkspaceId,
          { name: "Other recipient" },
        );
        const secondRecipient = await givingRecipientsService.createRecipient(
          userId,
          workspaceId,
          { name: "Second recipient" },
        );

        const expense = await recurringMoneyService.create(userId, workspaceId, {
          name: "Hosting",
          amount: 20,
          dayOfMonth: 1,
          clientId: client.id,
          rebillMode: "at_cost",
        });
        assert.equal(expense.type, "expense", "legacy create calls default to expenses");
        const settledExpense = await recurringMoneyService.create(userId, workspaceId, {
          name: "Rent",
          amount: 800,
          dayOfMonth: 1,
        });
        const settlement = await paymentLogsService.create(
          userId,
          settledExpense.id,
          {
            amount: 800,
            paidAt: "2026-08-01",
            periodMonth: "2026-08-01",
          },
          workspaceId,
        );
        const income = await recurringMoneyService.create(userId, workspaceId, {
          name: "Salary",
          amount: 2000,
          type: "income",
          dayOfMonth: 25,
        });
        const giving = await recurringMoneyService.create(userId, workspaceId, {
          name: "Monthly gift",
          amount: 100,
          type: "giving",
          dayOfMonth: 5,
          givingRecipientId: recipient.id,
          givingDesignationId: designation.id,
        });

        assert.deepEqual(
          (await recurringMoneyService.list(userId, workspaceId, undefined, "expense")).map(
            (row) => row.id,
          ).sort(),
          [expense.id, settledExpense.id].sort(),
        );
        assert.deepEqual(
          (await recurringMoneyService.list(userId, workspaceId)).map((row) => row.id).sort(),
          [expense.id, settledExpense.id, income.id, giving.id].sort(),
        );
        const givingRow = (await recurringMoneyService.list(
          userId,
          workspaceId,
          undefined,
          "giving",
        ))[0];
        assert.equal(givingRow?.givingRecipientName, "Community Church");
        assert.equal(givingRow?.givingDesignationName, "Building fund");

        await assert.rejects(
          () => recurringMoneyService.update(
            userId,
            settledExpense.id,
            { type: "income" },
            workspaceId,
          ),
          /type cannot change after payments have been logged/,
        );
        await assert.rejects(
          () => recurringMoneyService.create(userId, workspaceId, {
            name: "Invalid income",
            amount: 10,
            type: "income",
            dayOfMonth: 1,
            clientId: client.id,
          }),
          /Clients can only be assigned to recurring expenses/,
        );
        await assert.rejects(
          () => recurringMoneyService.create(userId, workspaceId, {
            name: "Cross-workspace gift",
            amount: 10,
            type: "giving",
            dayOfMonth: 1,
            givingRecipientId: otherRecipient.id,
          }),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.create(userId, workspaceId, {
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
          () => recurringMoneyService.update(
            userId,
            expense.id,
            { type: "income" },
            workspaceId,
          ),
          /Only recurring expenses can use client recovery terms/,
        );
        await recurringMoneyService.update(
          userId,
          expense.id,
          { type: "income", clientId: null, rebillMode: "none", rebillAmount: null },
          workspaceId,
        );
        await assert.rejects(
          () => recurringMoneyService.update(
            userId,
            income.id,
            { amount: 2100 },
            otherWorkspaceId,
          ),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.update(
            userId,
            income.id,
            { amount: 2200 },
            workspaceId,
            "expense",
          ),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.remove(userId, income.id, workspaceId, "expense"),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.remove(userId, income.id, otherWorkspaceId),
          /not found or unauthorized/,
        );
        assert.equal(
          (await paymentLogsService.listForOutgoing(
            userId,
            settledExpense.id,
            workspaceId,
          )).length,
          1,
        );
        assert.equal(
          (await paymentLogsService.getMonthlyStatus(
            userId,
            "2026-08-01",
            workspaceId,
          )).get(settledExpense.id)?.id,
          settlement.id,
        );
        assert.equal(
          (await paymentLogsService.getMonthlyStatus(
            userId,
            "2026-08-01",
            otherWorkspaceId,
          )).size,
          0,
        );
        await assert.rejects(
          () => paymentLogsService.listForOutgoing(
            userId,
            settledExpense.id,
            otherWorkspaceId,
          ),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => paymentLogsService.remove(
            userId,
            settledExpense.id,
            settlement.id,
            otherWorkspaceId,
          ),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => paymentLogsService.create(
            userId,
            giving.id,
            {
              amount: 100,
              paidAt: "2026-08-01",
              periodMonth: "2026-08-01",
            },
            workspaceId,
          ),
          /not found or unauthorized/,
        );
        await assert.rejects(
          () => recurringMoneyService.update(
            userId,
            giving.id,
            { type: "income" },
            workspaceId,
          ),
          /Giving attribution can only be assigned to recurring giving/,
        );
        const formerGiving = await recurringMoneyService.update(
          userId,
          giving.id,
          { type: "income", givingRecipientId: null, givingDesignationId: null },
          workspaceId,
        );
        assert.equal(formerGiving.type, "income");
        assert.equal(formerGiving.givingRecipientId, null);
        assert.equal(formerGiving.givingDesignationId, null);

        const analytics = await analyticsService.getAnalytics(userId, workspaceId, "custom", {
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
  },
);
