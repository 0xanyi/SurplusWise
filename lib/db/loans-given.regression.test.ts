import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { loansGiven, users, workspaces } from "@/db/schema";
import * as loansService from "./loans-given";

/**
 * Guards the invariant the derived interest figures rest on: the stored
 * `outstanding_balance` and the schedule computed on read must agree, whatever
 * mutation path got the loan into its current state.
 */
describe(
  "loans given regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    async function seed() {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Loan test user",
        email: `loan-${userId.slice(0, 8)}@example.com`,
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

    it("keeps the stored balance in step with the derived schedule when a repayment is future-dated", async () => {
      // A repayment dated next year must not zero the stored balance while the
      // schedule still charges interest on the full principal: the loan page
      // renders both figures side by side, and net worth reads the stored one.
      const { userId, workspaceId } = await seed();

      try {
        const loan = await loansService.create(workspaceId, {
          borrowerName: "Future dated",
          amount: 10_000,
          loanDate: "2025-01-15",
          interestRate: 3.5,
        });

        const future = new Date();
        future.setUTCFullYear(future.getUTCFullYear() + 1);
        await loansService.addRepayment(workspaceId, loan.id, {
          amount: 10_000,
          repaymentDate: future.toISOString().slice(0, 10),
        });

        const { row, interest } = await loansService.getById(workspaceId, loan.id);

        assert.equal(
          Number(row.outstandingBalance),
          10_000,
          "a repayment that has not happened yet must not reduce the stored balance",
        );
        assert.equal(row.status, "active");
        assert.equal(
          Number(row.outstandingBalance) + interest.interestOutstanding,
          interest.payoffToday,
          "stored principal plus derived interest must equal the payoff shown",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("settles principal before interest and derives the status from the ledger", async () => {
      const { userId, workspaceId } = await seed();

      try {
        const loan = await loansService.create(workspaceId, {
          borrowerName: "Partial then settled",
          amount: 1000,
          loanDate: "2025-01-15",
          interestRate: 1,
        });

        await loansService.addRepayment(workspaceId, loan.id, {
          amount: 400,
          repaymentDate: "2025-03-15",
        });

        const partial = await loansService.getById(workspaceId, loan.id);
        assert.equal(Number(partial.row.outstandingBalance), 600);
        assert.equal(partial.row.status, "partially_repaid");
        assert.ok(
          partial.interest.interestOutstanding > 0,
          "interest should still be owed after a part-payment",
        );
        assert.equal(partial.interest.interestPaid, 0, "principal settles first");

        await loansService.addRepayment(workspaceId, loan.id, {
          amount: partial.interest.payoffToday,
          repaymentDate: new Date().toISOString().slice(0, 10),
        });

        const settled = await loansService.getById(workspaceId, loan.id);
        assert.equal(Number(settled.row.outstandingBalance), 0);
        assert.equal(
          settled.row.status,
          "fully_repaid",
          "fully_repaid requires principal and interest both covered",
        );
        assert.equal(settled.interest.interestOutstanding, 0);
        assert.ok(settled.interest.settledOn, "a cleared loan records when it cleared");
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("freezes accrual when a loan is written off and resumes it on reinstatement", async () => {
      const { userId, workspaceId } = await seed();

      try {
        const loan = await loansService.create(workspaceId, {
          borrowerName: "Written off",
          amount: 10_000,
          loanDate: "2025-01-15",
          interestRate: 3.5,
        });

        await loansService.update(workspaceId, loan.id, { status: "defaulted" });
        const frozen = await loansService.getById(workspaceId, loan.id);

        assert.equal(frozen.row.status, "defaulted");
        assert.ok(frozen.row.accrualStoppedOn, "writing off stamps the date accrual stopped");

        await loansService.update(workspaceId, loan.id, { status: "active" });
        const reinstated = await loansService.getById(workspaceId, loan.id);

        assert.equal(reinstated.row.accrualStoppedOn, null, "reinstating releases the freeze");
        assert.ok(
          reinstated.interest.accruedInterest >= frozen.interest.accruedInterest,
          "interest resumes from where the freeze left it",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("rejects a loan date far enough out to stall the interest schedule", async () => {
      // `9999-12-31` is ~95,700 monthly periods, which blocks the event loop
      // for every other loan in the same request.
      const { userId, workspaceId } = await seed();

      try {
        await assert.rejects(
          loansService.create(workspaceId, {
            borrowerName: "Implausible",
            amount: 100,
            loanDate: "2025-01-15",
            expectedPaybackDate: "9999-12-31",
          }),
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
