import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, users, workspaces } from "@/db/schema";
import * as recurringMoneyService from "@/lib/db/recurring-outgoings";
import * as transactionsService from "@/lib/db/transactions";
import {
  createRecurringMoneyOccurrences,
  fixedClock,
  recurringMoneyOccurrenceId,
  type ValidatedImportCandidate,
} from "@/lib/recurring-money-occurrences";

const occurrences = createRecurringMoneyOccurrences(
  fixedClock("2028-04-10T12:00:00.000Z"),
);

async function fixture(name: string) {
  const userId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name,
    email: `${name.toLowerCase().replaceAll(" ", "-")}-${userId.slice(0, 8)}@example.com`,
  });
  await db.insert(workspaces).values({
    id: workspaceId,
    userId,
    name: "Personal",
    type: "personal",
    currency: "GBP",
    isDefault: true,
  });
  return { userId, workspaceId };
}

function candidate(
  fingerprint: string,
  lineNumber: number,
  amount: number,
  date: string,
  payee: string,
): ValidatedImportCandidate {
  return {
    fingerprint,
    lineNumber,
    amount,
    date,
    type: "expense",
    category: "Uncategorized",
    payee,
    notes: null,
    tags: [],
  };
}

describe(
  "Recurring money occurrence lifecycle",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("keeps reads side-effect free and freezes a recorded occurrence", async () => {
      const { userId, workspaceId } = await fixture("Occurrence projection user");
      try {
        const clientId = crypto.randomUUID();
        await db.insert(clients).values({
          id: clientId,
          userId,
          workspaceId,
          name: "Property client",
        });
        const schedule = await recurringMoneyService.create(workspaceId, {
          name: "Electricity",
          amount: 100,
          type: "expense",
          dayOfMonth: 30,
          category: "Utilities",
          vendor: "Power Company",
          clientId,
          rebillMode: "fixed",
          rebillAmount: 110,
        });
        const id = recurringMoneyOccurrenceId(schedule.id, "2028-04-01");

        const current = await occurrences.month(workspaceId, "2028-04-01");
        const projected = current.occurrences.find((row) => row.id === id);
        assert.equal(projected?.state, "projected");
        assert.equal(projected?.dueDate, "2028-04-30");
        assert.equal(
          (await occurrences.month(workspaceId, "2028-04-01")).occurrences[0].state,
          "projected",
          "month reads must not record projected occurrences",
        );
        assert.equal(
          (await occurrences.month(workspaceId, "2028-03-01")).occurrences.length,
          0,
          "past months must not invent occurrences from today's schedule",
        );
        await assert.rejects(
          () =>
            occurrences.revise(workspaceId, {
              occurrenceId: recurringMoneyOccurrenceId(schedule.id, "2028-03-01"),
              expectedAmount: 100,
            }),
          /must already be recorded/,
        );

        const recorded = await occurrences.revise(workspaceId, {
          occurrenceId: id,
          expectedAmount: 120,
        });
        assert.equal(recorded.state, "recorded");
        assert.equal(recorded.expectedAmount, 120);

        await recurringMoneyService.update(workspaceId, schedule.id, {
          name: "Renamed electricity",
          amount: 150,
          dayOfMonth: 5,
          rebillAmount: 175,
        });
        const frozen = (await occurrences.month(workspaceId, "2028-04-01")).occurrences[0];
        assert.equal(frozen.name, "Electricity");
        assert.equal(frozen.expectedAmount, 120);
        assert.equal(frozen.dueDate, "2028-04-30");
        assert.equal(frozen.rebillAmount, 110);

        const future = (await occurrences.month(workspaceId, "2028-05-01")).occurrences[0];
        assert.equal(future.state, "projected");
        assert.equal(future.name, "Renamed electricity");
        assert.equal(future.expectedAmount, 150);
        assert.equal(future.dueDate, "2028-05-05");
        assert.equal(future.rebillAmount, 175);

        await recurringMoneyService.update(workspaceId, schedule.id, { isActive: false });
        assert.equal((await occurrences.month(workspaceId, "2028-06-01")).occurrences.length, 0);
        await assert.rejects(
          () =>
            occurrences.revise(workspaceId, {
              occurrenceId: recurringMoneyOccurrenceId(schedule.id, "2028-06-01"),
              expectedAmount: 160,
            }),
          /Inactive or missing Recurring money/,
        );
        await assert.rejects(
          () => recurringMoneyService.remove(workspaceId, schedule.id),
          /recorded occurrences/,
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("owns settlement invariants and preserves external Transactions", async () => {
      const { userId, workspaceId } = await fixture("Occurrence settlement user");
      const otherWorkspaceId = crypto.randomUUID();
      try {
        await db.insert(workspaces).values({
          id: otherWorkspaceId,
          userId,
          name: "Other books",
          type: "personal",
          currency: "GBP",
          isDefault: false,
        });
        const schedule = await recurringMoneyService.create(workspaceId, {
          name: "Rent",
          amount: 100,
          type: "expense",
          dayOfMonth: 1,
          category: "Housing",
          vendor: "Landlord",
        });
        const occurrenceId = recurringMoneyOccurrenceId(schedule.id, "2028-04-01");
        assert.equal((await occurrences.month(otherWorkspaceId, "2028-04-01")).occurrences.length, 0);
        await assert.rejects(
          () =>
            occurrences.settle(otherWorkspaceId, {
              action: "mark-paid",
              occurrenceId,
              paidAt: "2028-04-01",
            }),
          /missing Recurring money/,
        );
        const external = await transactionsService.create(workspaceId, {
          amount: 40,
          date: "2028-04-01",
          type: "expense",
          category: "Housing",
          payee: "Landlord",
        });

        const partial = await occurrences.settle(workspaceId, {
          action: "match",
          occurrenceId,
          transactionId: external.id,
        });
        assert.equal(partial.occurrence.status, "partial");
        assert.equal(partial.occurrence.settlements[0].provenance, "externally-created");

        await transactionsService.update(workspaceId, external.id, {
          amount: 50,
          date: "2028-04-20",
        });
        assert.equal(
          (await occurrences.month(workspaceId, "2028-04-01")).occurrences[0].recordedAmount,
          50,
          "amount and date corrections must remain matched",
        );
        await assert.rejects(
          () => transactionsService.update(workspaceId, external.id, { type: "income" }),
          /Unmatch this Transaction/,
        );

        const paid = await occurrences.settle(workspaceId, {
          action: "mark-paid",
          occurrenceId,
          paidAt: "2028-04-21",
        });
        assert.equal(paid.occurrence.status, "settled");
        assert.equal(paid.occurrence.recordedAmount, 100);
        const owned = paid.occurrence.settlements.find(
          (settlement) => settlement.provenance === "lifecycle-created",
        );
        assert.equal(owned?.amount, 50, "mark paid must create only the outstanding amount");

        await occurrences.settle(workspaceId, {
          action: "unmatch",
          occurrenceId,
          transactionId: owned?.transactionId ?? "",
        });
        assert.equal(await transactionsService.getById(workspaceId, owned?.transactionId ?? ""), null);
        assert.ok(await transactionsService.getById(workspaceId, external.id));

        const overpayment = await transactionsService.create(workspaceId, {
          amount: 100,
          date: "2028-04-22",
          type: "expense",
          category: "Housing",
        });
        const overpaid = await occurrences.settle(workspaceId, {
          action: "match",
          occurrenceId,
          transactionId: overpayment.id,
        });
        assert.equal(overpaid.occurrence.status, "overpaid");
        assert.equal(overpaid.occurrence.overpaidAmount, 50);
        await assert.rejects(
          () => recurringMoneyService.remove(otherWorkspaceId, schedule.id),
          /not found or unauthorized/,
        );
        await occurrences.settle(workspaceId, {
          action: "unmatch",
          occurrenceId,
          transactionId: overpayment.id,
        });
        assert.ok(
          await transactionsService.getById(workspaceId, overpayment.id),
          "unmatching must preserve an externally created Transaction",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("previews imports without writes and commits matches atomically", async () => {
      const { userId, workspaceId } = await fixture("Occurrence import user");
      try {
        const schedule = await recurringMoneyService.create(workspaceId, {
          name: "Broadband",
          amount: 100,
          type: "expense",
          dayOfMonth: 15,
          category: "Utilities",
          vendor: "Example Telecom",
        });
        const matched = candidate(
          "matched-fingerprint",
          2,
          100,
          "2028-04-15",
          "Example Telecom Ltd",
        );
        const unmatched = candidate(
          "unmatched-fingerprint",
          3,
          25,
          "2028-04-18",
          "Corner Shop",
        );

        const preview = await occurrences.importTransactions(workspaceId, {
          mode: "preview",
          accountId: null,
          candidates: [matched, unmatched],
        });
        assert.deepEqual(preview.matchedLineNumbers, [2]);
        assert.equal(
          (await occurrences.month(workspaceId, "2028-04-01")).occurrences[0].state,
          "projected",
        );
        assert.equal((await transactionsService.list(workspaceId)).length, 0);

        const committed = await occurrences.importTransactions(workspaceId, {
          mode: "commit",
          accountId: null,
          candidates: [matched, unmatched],
        });
        assert.equal(committed.importedIds.length, 2);
        assert.deepEqual(committed.matchedLineNumbers, [2]);
        const occurrence = (await occurrences.month(workspaceId, "2028-04-01")).occurrences.find(
          (row) => row.recurringMoneyId === schedule.id,
        );
        assert.equal(occurrence?.state, "recorded");
        assert.equal(occurrence?.status, "settled");
        assert.equal(occurrence?.settlements[0].provenance, "externally-created");
        const importedRows = await transactionsService.list(workspaceId);
        assert.equal(
          importedRows.find((row) => row.importFingerprint === matched.fingerprint)?.needsReview,
          false,
        );
        assert.equal(
          importedRows.find((row) => row.importFingerprint === unmatched.fingerprint)?.needsReview,
          true,
        );

        const repeat = await occurrences.importTransactions(workspaceId, {
          mode: "commit",
          accountId: null,
          candidates: [matched, unmatched],
        });
        assert.equal(repeat.importedIds.length, 0);
        assert.deepEqual(repeat.duplicateLineNumbers, [2, 3]);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("serializes concurrent import allocation through the occurrence", async () => {
      const { userId, workspaceId } = await fixture("Occurrence concurrency user");
      try {
        const schedule = await recurringMoneyService.create(workspaceId, {
          name: "Contract instalment",
          amount: 100,
          type: "expense",
          dayOfMonth: 15,
          category: "Professional services",
          vendor: "Example Supplier",
        });
        const first = candidate("concurrent-a", 2, 60, "2028-04-15", "Example Supplier");
        const second = candidate("concurrent-b", 3, 60, "2028-04-15", "Example Supplier");

        const results = await Promise.all([
          occurrences.importTransactions(workspaceId, {
            mode: "commit",
            accountId: null,
            candidates: [first],
          }),
          occurrences.importTransactions(workspaceId, {
            mode: "commit",
            accountId: null,
            candidates: [second],
          }),
        ]);
        assert.equal(
          results.reduce((sum, result) => sum + result.matchedLineNumbers.length, 0),
          1,
        );
        const occurrence = (await occurrences.month(workspaceId, "2028-04-01")).occurrences.find(
          (row) => row.recurringMoneyId === schedule.id,
        );
        assert.equal(occurrence?.recordedAmount, 60);
        assert.equal(occurrence?.status, "partial");
        assert.equal(
          (await transactionsService.list(workspaceId)).filter((row) => row.needsReview).length,
          1,
          "the losing concurrent row must remain imported but unlinked for review",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
