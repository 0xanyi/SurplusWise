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
        assert.equal(drafts.filter((draft) => draft.transactionId).length, 2);
        assert.equal(drafts.filter((draft) => !draft.transactionId).length, 2);
        const matchedGift = drafts.find((draft) => draft.type === "giving");
        const [giftTransaction] = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, matchedGift?.transactionId ?? ""));
        assert.equal(giftTransaction.category, "Giving");
        assert.equal(giftTransaction.givingRecipientId, recipient.id);
        assert.equal(giftTransaction.givingDesignationId, designation.id);
        assert.equal(giftTransaction.needsReview, false);
        await assert.rejects(
          () => draftsService.unmatch(userId, otherWorkspaceId, matchedGift?.id ?? ""),
          /not found or unauthorized/,
        );
        await draftsService.unmatch(userId, workspaceId, matchedGift?.id ?? "");
        assert.equal(
          (await draftsService.list(userId, workspaceId, "2028-02-01")).find(
            (draft) => draft.id === matchedGift?.id,
          )?.transactionId,
          null,
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
  },
);
