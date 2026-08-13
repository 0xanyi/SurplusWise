import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions, users, workspaces } from "@/db/schema";
import * as givingRecipientsService from "./giving-recipients";
import * as draftsService from "./recurring-money-drafts";
import * as recurringMoneyService from "./recurring-outgoings";
import * as transactionsService from "./transactions";

describe(
  "recurring money drafts and import matching",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("generates stable monthly drafts and matches only unambiguous imports", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Recurring draft test user",
        email: `recurring-draft-${userId.slice(0, 8)}@example.com`,
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
        const recipient = await givingRecipientsService.createRecipient(
          userId,
          workspaceId,
          { name: "Community Church" },
        );
        const designation = await givingRecipientsService.createDesignation(
          userId,
          workspaceId,
          { recipientId: recipient.id, name: "Community work" },
        );
        const salary = await recurringMoneyService.create(userId, workspaceId, {
          name: "Salary",
          amount: 2500,
          type: "income",
          dayOfMonth: 31,
          category: "Salary",
          vendor: "Acme Payroll",
        });
        await recurringMoneyService.create(userId, workspaceId, {
          name: "Monthly gift",
          amount: 100,
          type: "giving",
          dayOfMonth: 5,
          category: "Giving",
          vendor: "Community Church",
          givingRecipientId: recipient.id,
          givingDesignationId: designation.id,
        });
        await recurringMoneyService.create(userId, workspaceId, {
          name: "Subscription A",
          amount: 25,
          dayOfMonth: 10,
        });
        await recurringMoneyService.create(userId, workspaceId, {
          name: "Subscription B",
          amount: 25,
          dayOfMonth: 10,
        });
        const inactive = await recurringMoneyService.create(userId, workspaceId, {
          name: "Inactive",
          amount: 50,
          dayOfMonth: 2,
        });
        await recurringMoneyService.update(
          userId,
          inactive.id,
          { isActive: false },
          workspaceId,
        );

        assert.equal((await draftsService.generate(userId, workspaceId, "2028-02-01")).length, 4);
        assert.equal(
          (await draftsService.generate(userId, workspaceId, "2028-02-01")).length,
          0,
          "generation must be idempotent",
        );
        assert.equal(
          (await draftsService.list(userId, otherWorkspaceId, "2028-02-01")).length,
          0,
        );
        const generated = await draftsService.list(userId, workspaceId, "2028-02-01");
        assert.equal(
          generated.find((draft) => draft.recurringMoneyId === salary.id)?.dueDate,
          "2028-02-29",
          "month-end schedules clamp to leap-day",
        );

        await recurringMoneyService.update(
          userId,
          salary.id,
          { amount: 2600, dayOfMonth: 28 },
          workspaceId,
        );
        const salaryDraft = (await draftsService.list(
          userId,
          workspaceId,
          "2028-02-01",
        )).find((draft) => draft.recurringMoneyId === salary.id);
        assert.equal(Number(salaryDraft?.expectedAmount), 2500);
        assert.equal(salaryDraft?.dueDate, "2028-02-29");
        assert.deepEqual(
          await draftsService.findImportMatches(userId, workspaceId, [
            {
              key: "late-salary",
              amount: 2500,
              date: "2028-03-08",
              type: "income",
              payee: "Acme Payroll",
            },
          ]),
          [],
          "matches outside the seven-day window must remain in review",
        );
        assert.deepEqual(
          await draftsService.findImportMatches(userId, otherWorkspaceId, [
            {
              key: "cross-workspace-salary",
              amount: 2500,
              date: "2028-02-28",
              type: "income",
              payee: "Acme Payroll",
            },
          ]),
          [],
        );

        const importRows: transactionsService.ImportInput[] = [
          {
            lineNumber: 2,
            amount: 2500,
            date: "2028-02-28",
            type: "income",
            category: "Uncategorized",
            payee: "ACME PAYROLL LTD",
            notes: "February payroll",
            tags: [],
            externalId: "salary-feb-2028",
          },
          {
            lineNumber: 3,
            amount: 100,
            date: "2028-02-07",
            type: "giving",
            category: "Uncategorized",
            payee: "Community Church Donation",
            notes: null,
            tags: [],
            externalId: "gift-feb-2028",
          },
          {
            lineNumber: 4,
            amount: 25,
            date: "2028-02-10",
            type: "expense",
            category: "Uncategorized",
            payee: "Unknown subscription",
            notes: null,
            tags: [],
            externalId: "subscription-feb-2028",
          },
          {
            lineNumber: 5,
            amount: 2500,
            date: "2028-02-28",
            type: "income",
            category: "Uncategorized",
            payee: "Different employer",
            notes: null,
            tags: [],
            externalId: "other-income-feb-2028",
          },
        ];
        const review = await transactionsService.reviewImport(
          userId,
          workspaceId,
          null,
          importRows,
        );
        assert.deepEqual(review.matchedLineNumbers, [2, 3]);

        const imported = await transactionsService.importRows(
          userId,
          workspaceId,
          null,
          importRows,
        );
        assert.equal(imported.importedIds.length, 4);
        assert.deepEqual(imported.matchedLineNumbers, [2, 3]);

        const drafts = await draftsService.list(userId, workspaceId, "2028-02-01");
        assert.equal(drafts.filter((draft) => draft.settlements.length > 0).length, 2);
        assert.equal(drafts.filter((draft) => draft.settlements.length === 0).length, 2);
        const matchedGift = drafts.find((draft) => draft.type === "giving");
        const giftTransactionId = matchedGift?.settlements[0]?.transactionId ?? "";
        const [giftTransaction] = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, giftTransactionId));
        assert.equal(giftTransaction.category, "Giving");
        assert.equal(giftTransaction.givingRecipientId, recipient.id);
        assert.equal(giftTransaction.givingDesignationId, designation.id);
        assert.equal(giftTransaction.needsReview, false);
        await assert.rejects(
          () =>
            draftsService.unmatch(
              userId,
              otherWorkspaceId,
              matchedGift?.id ?? "",
              giftTransactionId,
            ),
          /not found or unauthorized/,
        );
        await draftsService.unmatch(
          userId,
          workspaceId,
          matchedGift?.id ?? "",
          giftTransactionId,
        );
        assert.equal(
          (await draftsService.list(userId, workspaceId, "2028-02-01")).find(
            (draft) => draft.id === matchedGift?.id,
          )?.settlements.length,
          0,
        );

        const repeat = await transactionsService.importRows(
          userId,
          workspaceId,
          null,
          importRows,
        );
        assert.equal(repeat.importedIds.length, 0);
        assert.deepEqual(repeat.duplicateLineNumbers, [2, 3, 4, 5]);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("supports variable expectations and multiple partial settlements", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Partial settlement test user",
        email: `partial-settlement-${userId.slice(0, 8)}@example.com`,
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
        const schedule = await recurringMoneyService.create(userId, workspaceId, {
          name: "Variable electricity",
          amount: 100,
          type: "expense",
          dayOfMonth: 15,
          category: "Utilities",
          vendor: "Power Company",
        });
        assert.equal(
          (await transactionsService.list(userId, workspaceId)).length,
          0,
          "expectation generation must not create ledger entries",
        );
        await draftsService.generate(userId, workspaceId, "2028-04-01");
        let draft = (await draftsService.list(userId, workspaceId, "2028-04-01")).find(
          (row) => row.recurringMoneyId === schedule.id,
        )!;
        assert.equal((await transactionsService.list(userId, workspaceId)).length, 0);

        const first = await transactionsService.create(userId, workspaceId, {
          amount: 40,
          date: "2028-04-14",
          type: "expense",
          category: "Utilities",
          payee: "Power Company",
        });
        const second = await transactionsService.create(userId, workspaceId, {
          amount: 30,
          date: "2028-04-16",
          type: "expense",
          category: "Utilities",
          payee: "Power Company",
        });
        await draftsService.matchTransaction(userId, workspaceId, draft.id, first.id);
        await draftsService.matchTransaction(userId, workspaceId, draft.id, second.id);
        draft = (await draftsService.list(userId, workspaceId, "2028-04-01"))[0];
        assert.equal(draft.status, "partial");
        assert.equal(draft.recordedAmount, 70);
        assert.equal(draft.outstandingAmount, 30);
        assert.equal(draft.settlements.length, 2);
        await assert.rejects(
          () => transactionsService.update(userId, first.id, { type: "income" }),
          /Unmatch this transaction from recurring money/,
        );

        await draftsService.updateExpectedAmount(userId, workspaceId, draft.id, 70);
        draft = (await draftsService.list(userId, workspaceId, "2028-04-01"))[0];
        assert.equal(draft.status, "settled");
        assert.equal(draft.outstandingAmount, 0);

        await draftsService.updateExpectedAmount(userId, workspaceId, draft.id, 60);
        draft = (await draftsService.list(userId, workspaceId, "2028-04-01"))[0];
        assert.equal(draft.status, "overpaid");
        assert.equal(draft.overpaidAmount, 10);
        await assert.rejects(
          () => draftsService.updateExpectedAmount(userId, workspaceId, draft.id, 0),
          /amount must be positive/,
        );

        const otherSchedule = await recurringMoneyService.create(userId, workspaceId, {
          name: "Other expense",
          amount: 40,
          type: "expense",
          dayOfMonth: 20,
        });
        await draftsService.generate(userId, workspaceId, "2028-04-01");
        const otherDraft = (await draftsService.list(userId, workspaceId, "2028-04-01")).find(
          (row) => row.recurringMoneyId === otherSchedule.id,
        )!;
        await assert.rejects(
          () => draftsService.matchTransaction(userId, workspaceId, otherDraft.id, first.id),
          /already matched/,
        );
        const wrongType = await transactionsService.create(userId, workspaceId, {
          amount: 10,
          date: "2028-04-15",
          type: "income",
          category: "Other",
        });
        await assert.rejects(
          () => draftsService.matchTransaction(userId, workspaceId, draft.id, wrongType.id),
          /type must match/,
        );
        const otherWorkspaceTransaction = await transactionsService.create(
          userId,
          otherWorkspaceId,
          {
            amount: 10,
            date: "2028-04-15",
            type: "expense",
            category: "Other",
          },
        );
        await assert.rejects(
          () =>
            draftsService.matchTransaction(
              userId,
              workspaceId,
              draft.id,
              otherWorkspaceTransaction.id,
            ),
          /not found or unauthorized/,
        );

        await draftsService.unmatch(userId, workspaceId, draft.id, first.id);
        draft = (await draftsService.list(userId, workspaceId, "2028-04-01")).find(
          (row) => row.id === draft.id,
        )!;
        assert.deepEqual(
          draft.settlements.map((settlement) => settlement.transactionId),
          [second.id],
          "unmatching one settlement must preserve the others",
        );
        await transactionsService.remove(userId, second.id);
        draft = (await draftsService.list(userId, workspaceId, "2028-04-01")).find(
          (row) => row.id === draft.id,
        )!;
        assert.equal(draft.recordedAmount, 0);
        assert.equal(draft.outstandingAmount, 60);
        assert.equal(draft.status, "draft");
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("auto-matches partial imports without exceeding the expected amount", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Partial import test user",
        email: `partial-import-${userId.slice(0, 8)}@example.com`,
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
        await recurringMoneyService.create(userId, workspaceId, {
          name: "Contract instalments",
          amount: 100,
          type: "income",
          dayOfMonth: 15,
          category: "Contract income",
          vendor: "Example Client",
        });
        await draftsService.generate(userId, workspaceId, "2028-05-01");
        const rows: transactionsService.ImportInput[] = [
          {
            lineNumber: 2,
            amount: 40,
            date: "2028-05-14",
            type: "income",
            category: "Uncategorized",
            payee: "Example Client Ltd",
            notes: null,
            tags: [],
            externalId: "contract-part-1",
          },
          {
            lineNumber: 3,
            amount: 60,
            date: "2028-05-16",
            type: "income",
            category: "Uncategorized",
            payee: "Example Client Ltd",
            notes: null,
            tags: [],
            externalId: "contract-part-2",
          },
          {
            lineNumber: 4,
            amount: 10,
            date: "2028-05-17",
            type: "income",
            category: "Uncategorized",
            payee: "Example Client Ltd",
            notes: null,
            tags: [],
            externalId: "contract-overpayment",
          },
        ];
        const review = await transactionsService.reviewImport(userId, workspaceId, null, rows);
        assert.deepEqual(review.matchedLineNumbers, [2, 3]);
        const imported = await transactionsService.importRows(userId, workspaceId, null, rows);
        assert.deepEqual(imported.matchedLineNumbers, [2, 3]);
        const [draft] = await draftsService.list(userId, workspaceId, "2028-05-01");
        assert.equal(draft.status, "settled");
        assert.equal(draft.recordedAmount, 100);
        assert.equal(draft.settlements.length, 2);
        const unmatchedTransaction = (await transactionsService.list(userId, workspaceId)).find(
          (row) => Number(row.amount) === 10,
        );
        assert.equal(unmatchedTransaction?.needsReview, true);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
