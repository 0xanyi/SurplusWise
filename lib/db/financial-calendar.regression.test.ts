import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as calendarService from "./financial-calendar";
import * as debtsService from "./debts-credits";
import * as statementsService from "./debt-statements";
import * as recurringMoneyService from "./recurring-outgoings";
import * as draftsService from "./recurring-money-drafts";
import * as transactionsService from "./transactions";
import * as paymentLogsService from "./outgoing-payment-logs";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";

describe(
  "financial calendar regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("combines recurring expectations and debt dates without changing ledger truth", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Calendar test user",
        email: `calendar-${userId.slice(0, 8)}@example.com`,
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
          dayOfMonth: 31,
        });
        const utility = await recurringMoneyService.create(userId, workspaceId, {
          name: "Electricity",
          amount: 100,
          type: "expense",
          dayOfMonth: 10,
        });
        await recurringMoneyService.create(userId, otherWorkspaceId, {
          name: "Other workspace rent",
          amount: 900,
          type: "expense",
          dayOfMonth: 1,
        });

        const forecastDebt = await debtsService.create(userId, workspaceId, {
          name: "Car loan",
          debtType: "loan",
          currentBalance: 5000,
          minimumPayment: 50,
          paymentDayOfMonth: 31,
        });
        const statementDebt = await debtsService.create(userId, workspaceId, {
          name: "Credit card",
          debtType: "credit_card",
          currentBalance: 1000,
          minimumPayment: 60,
          paymentDayOfMonth: 20,
        });
        await statementsService.createStatement(userId, statementDebt.id, {
          periodStart: "2028-01-01",
          periodEnd: "2028-01-31",
          statementDate: "2028-01-31",
          dueDate: "2028-02-20",
          openingBalance: 900,
          closingBalance: 1000,
          minimumPayment: 75,
        });
        await statementsService.createPayment(userId, statementDebt.id, {
          amount: 25,
          paidAt: "2028-02-10",
        });

        let calendar = await calendarService.getMonth(userId, workspaceId, "2028-02-01");
        assert.deepEqual(
          calendar.events.map((event) => event.title),
          ["Electricity", "Credit card", "Car loan", "Salary"],
        );
        assert.equal(
          calendar.events.find((event) => event.sourceId === forecastDebt.id)?.date,
          "2028-02-29",
          "recurring days must clamp to the selected month",
        );
        const statementEvent = calendar.events.find(
          (event) => event.sourceId === statementDebt.id,
        );
        assert.equal(statementEvent?.certainty, "statement");
        assert.equal(statementEvent?.amount, 75);
        assert.equal(statementEvent?.recordedAmount, 25);
        assert.equal(statementEvent?.outstandingAmount, 50);
        assert.equal(statementEvent?.status, "partial");
        assert.equal(calendar.summary.expectedIncome, 1000);
        assert.equal(calendar.summary.expectedOutflow, 225);
        assert.equal(calendar.summary.incomingOutstanding, 1000);
        assert.equal(calendar.summary.outgoingOutstanding, 200);
        assert.equal(
          (await transactionsService.list(userId, workspaceId)).length,
          0,
          "calendar projections must not create transactions",
        );
        assert.equal(
          (await draftsService.list(userId, workspaceId, "2028-02-01")).length,
          0,
          "viewing a future month must not freeze its expectations as drafts",
        );
        assert.equal(
          (await calendarService.getMonth(userId, otherWorkspaceId, "2028-02-01")).events.length,
          1,
          "calendar events must remain workspace-scoped",
        );

        await draftsService.generate(userId, workspaceId, "2028-02-01");
        const utilityDraft = (await draftsService.list(
          userId,
          workspaceId,
          "2028-02-01",
        )).find((draft) => draft.recurringMoneyId === utility.id)!;
        const payment = await transactionsService.create(userId, workspaceId, {
          amount: 40,
          date: "2028-02-10",
          type: "expense",
          category: "Utilities",
        });
        await draftsService.matchTransaction(
          userId,
          workspaceId,
          utilityDraft.id,
          payment.id,
        );
        calendar = await calendarService.getMonth(userId, workspaceId, "2028-02-01");
        const utilityEvent = calendar.events.find((event) => event.title === "Electricity");
        assert.equal(utilityEvent?.status, "partial");
        assert.equal(utilityEvent?.recordedAmount, 40);
        assert.equal(utilityEvent?.outstandingAmount, 60);
        assert.equal(calendar.summary.outgoingOutstanding, 160);

        const currentMonth = getPeriodMonthFromDate(getCurrentUtcDate());
        await calendarService.getMonth(userId, workspaceId, currentMonth);
        assert.equal(
          (await draftsService.list(userId, workspaceId, currentMonth)).length,
          2,
          "the current month should materialize drafts for import matching",
        );
        assert.equal(
          (await transactionsService.list(userId, workspaceId)).length,
          1,
          "materialized expectations must remain outside the ledger",
        );
        await paymentLogsService.create(
          userId,
          utility.id,
          {
            amount: 100,
            paidAt: getCurrentUtcDate(),
            periodMonth: currentMonth,
          },
          workspaceId,
        );
        const currentCalendar = await calendarService.getMonth(
          userId,
          workspaceId,
          currentMonth,
        );
        const currentUtility = currentCalendar.events.find(
          (event) => event.title === "Electricity",
        );
        assert.equal(currentUtility?.status, "settled");
        assert.equal(currentUtility?.recordedAmount, 100);
        assert.equal(currentUtility?.outstandingAmount, 0);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
