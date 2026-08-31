import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loansGiven, loanRepayments } from "@/db/schema";
import {
  deriveLoanStatus,
  summariseLoanInterest,
  accrueLoanInterest,
  type LoanInterestView,
  type LoanRepaymentEntry,
} from "@/lib/loan-interest";
import { getCurrentUtcDate } from "@/lib/outgoings-date";
import type { LoanStatus } from "@/types";
import {
  idSchema,
  loanGivenCreateSchema,
  loanGivenUpdateSchema,
  loanRepaymentCreateSchema,
  workspaceIdSchema,
} from "./validation";
import { ownerUserId } from "./workspaces";

// ─── Types ───────────────────────────────────────────────────────────────────

type LoanRow = typeof loansGiven.$inferSelect;

/** A loan with every interest figure derived from its own repayment ledger. */
export interface LoanWithInterest {
  row: LoanRow;
  interest: LoanInterestView;
}

export interface CreateInput {
  borrowerName: string;
  amount: number;
  loanDate: string;
  expectedPaybackDate?: string | null;
  interestRate?: number | null;
  notes?: string | null;
}

export interface UpdateInput {
  borrowerName?: string;
  amount?: number;
  // `outstandingBalance` is deliberately absent. It is defined as
  // `amount − Σ repayments` and is rederived from the ledger on every
  // mutation; letting a caller set it by hand would break the identity that
  // makes the interest figures correct.
  loanDate?: string;
  expectedPaybackDate?: string | null;
  status?: LoanStatus;
  interestRate?: number | null;
  notes?: string | null;
}

export interface RepaymentInput {
  amount: number;
  repaymentDate: string;
  notes?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

/** Ledger rows in the shape the interest arithmetic wants. */
function toEntries(
  rows: readonly { amount: string; repaymentDate: string }[],
): LoanRepaymentEntry[] {
  return rows.map((row) => ({ amount: Number(row.amount), repaymentDate: row.repaymentDate }));
}

/**
 * Rederive `outstanding_balance` and `status` from the repayment ledger and
 * write them.
 *
 * Every mutation routes through here — repayment added, repayment deleted, rate
 * or principal or date edited — because status now depends on accrued interest,
 * which depends on all of those. Skipping it on an edit is how a loan ends up
 * stored as `fully_repaid` while the interest beside it says money is owed.
 *
 * Must run inside the caller's transaction: it reads the ledger it is about to
 * derive from, so a concurrent repayment would otherwise be lost.
 */
async function recomputeFromLedger(
  tx: Pick<typeof db, "select" | "update">,
  loan: Pick<LoanRow, "id" | "workspaceId" | "amount" | "loanDate" | "interestRate" | "status" | "accrualStoppedOn">,
  now: Date,
) {
  const ledger = await tx
    .select({ amount: loanRepayments.amount, repaymentDate: loanRepayments.repaymentDate })
    .from(loanRepayments)
    .where(eq(loanRepayments.loanId, loan.id));

  const repayments = toEntries(ledger);
  const principal = Number(loan.amount);

  const schedule = accrueLoanInterest({
    principal,
    monthlyRatePercent: loan.interestRate != null ? Number(loan.interestRate) : null,
    loanDate: loan.loanDate,
    repayments,
    accrualStoppedOn: loan.accrualStoppedOn,
    asOf: getCurrentUtcDate(),
  });

  // A loan written off but then repaid in full is not in default, whatever was
  // judged earlier — so settlement releases the freeze along with the status.
  const stillDefaulted = loan.status === "defaulted" && !schedule.isSettled;

  await tx
    .update(loansGiven)
    .set({
      // Taken from the schedule rather than recomputed here: the schedule only
      // counts repayments dated on or before today, and a stored balance that
      // counted future-dated rows too would contradict every derived figure
      // shown beside it — and understate net worth, which reads this column.
      outstandingBalance: String(schedule.principalOutstanding),
      status: deriveLoanStatus(schedule, stillDefaulted),
      accrualStoppedOn: stillDefaulted ? loan.accrualStoppedOn : null,
      updatedAt: now,
    })
    .where(and(eq(loansGiven.id, loan.id), eq(loansGiven.workspaceId, loan.workspaceId)));
}

// ─── Loans Given Service ─────────────────────────────────────────────────────

/**
 * Every loan with its interest figures.
 *
 * Accrual on a declining balance needs each loan's whole repayment timeline,
 * not a total, so the ledger is fetched in one indexed pass over
 * `idx_loan_repayments_loan` and grouped in memory. The alternative — figures
 * only on the detail page — would mean opening every loan to find out which
 * one is quietly stacking up interest.
 */
export async function list(
  workspaceId: string,
  status?: LoanStatus,
): Promise<LoanWithInterest[]> {
  workspaceIdSchema.parse(workspaceId);
  const conditions = [eq(loansGiven.workspaceId, workspaceId)];
  if (status !== undefined) conditions.push(eq(loansGiven.status, status));

  const rows = await db
    .select()
    .from(loansGiven)
    .where(and(...conditions))
    .orderBy(loansGiven.borrowerName);

  if (rows.length === 0) return [];

  const ledger = await db
    .select({
      loanId: loanRepayments.loanId,
      amount: loanRepayments.amount,
      repaymentDate: loanRepayments.repaymentDate,
    })
    .from(loanRepayments)
    .where(inArray(loanRepayments.loanId, rows.map((row) => row.id)));

  const byLoan = new Map<string, LoanRepaymentEntry[]>();
  for (const entry of ledger) {
    const existing = byLoan.get(entry.loanId);
    const mapped = { amount: Number(entry.amount), repaymentDate: entry.repaymentDate };
    if (existing) existing.push(mapped);
    else byLoan.set(entry.loanId, [mapped]);
  }

  const today = getCurrentUtcDate();
  return rows.map((row) => ({
    row,
    interest: summariseLoanInterest({
      principal: Number(row.amount),
      monthlyRatePercent: row.interestRate != null ? Number(row.interestRate) : null,
      loanDate: row.loanDate,
      expectedPaybackDate: row.expectedPaybackDate,
      accrualStoppedOn: row.accrualStoppedOn,
      repayments: byLoan.get(row.id) ?? [],
      today,
    }),
  }));
}

/** One loan with its interest figures and full monthly schedule. */
export async function getById(workspaceId: string, id: string): Promise<LoanWithInterest> {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);

  const [row] = await db
    .select()
    .from(loansGiven)
    .where(and(eq(loansGiven.id, id), eq(loansGiven.workspaceId, workspaceId)))
    .limit(1);

  if (!row) throw new Error("Loan not found or unauthorized");

  const ledger = await db
    .select({ amount: loanRepayments.amount, repaymentDate: loanRepayments.repaymentDate })
    .from(loanRepayments)
    .where(eq(loanRepayments.loanId, id));

  return {
    row,
    interest: summariseLoanInterest({
      principal: Number(row.amount),
      monthlyRatePercent: row.interestRate != null ? Number(row.interestRate) : null,
      loanDate: row.loanDate,
      expectedPaybackDate: row.expectedPaybackDate,
      accrualStoppedOn: row.accrualStoppedOn,
      repayments: toEntries(ledger),
      today: getCurrentUtcDate(),
    }),
  };
}

/** Get summary totals for active loans (receivables). */
export async function getSummary(workspaceId: string) {
  workspaceIdSchema.parse(workspaceId);

  const [result] = await db
    .select({
      totalLent: sql<string>`coalesce(sum(${loansGiven.amount}), 0)`,
      totalOutstanding: sql<string>`coalesce(sum(${loansGiven.outstandingBalance}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(loansGiven)
    .where(
      and(
        eq(loansGiven.workspaceId, workspaceId),
        inArray(loansGiven.status, ["active", "partially_repaid"]),
      ),
    );

  return {
    totalLent: Number(result.totalLent),
    totalOutstanding: Number(result.totalOutstanding),
    count: result.count,
  };
}

/** Create a new loan given record. */
export async function create(workspaceId: string, input: CreateInput) {
  workspaceIdSchema.parse(workspaceId);
  loanGivenCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  const id = genId();
  const now = new Date();

  const [row] = await db
    .insert(loansGiven)
    .values({
      id,
      userId,
      workspaceId,
      borrowerName: input.borrowerName,
      amount: String(input.amount),
      outstandingBalance: String(input.amount),
      loanDate: input.loanDate,
      expectedPaybackDate: input.expectedPaybackDate ?? null,
      status: "active",
      interestRate: input.interestRate != null ? String(input.interestRate) : null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

/**
 * Partial update. Throws if not found / unauthorized.
 *
 * `status` is only honoured as the manual judgement it is — writing off a loan,
 * or taking that judgement back. Every other status is rederived from the
 * ledger afterwards, because a caller cannot know whether the interest accrued
 * since the last repayment leaves the loan settled.
 */
export async function update(workspaceId: string, id: string, input: UpdateInput) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  loanGivenUpdateSchema.parse(input);

  const now = new Date();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(loansGiven)
      .where(and(eq(loansGiven.id, id), eq(loansGiven.workspaceId, workspaceId)))
      .limit(1);

    if (!existing) throw new Error("Loan not found or unauthorized");

    const becomingDefaulted = input.status === "defaulted";
    const leavingDefault = input.status !== undefined && input.status !== "defaulted";

    // The freeze date is stamped the moment the judgement is made. Deriving it
    // later from `updated_at` would let an unrelated edit inflate the frozen
    // figure by every month that had passed in between.
    const accrualStoppedOn = becomingDefaulted
      ? (existing.accrualStoppedOn ?? getCurrentUtcDate())
      : leavingDefault
        ? null
        : existing.accrualStoppedOn;

    const [row] = await tx
      .update(loansGiven)
      .set({
        ...(input.borrowerName !== undefined && { borrowerName: input.borrowerName }),
        ...(input.amount !== undefined && { amount: String(input.amount) }),
        ...(input.loanDate !== undefined && { loanDate: input.loanDate }),
        ...(input.expectedPaybackDate !== undefined && { expectedPaybackDate: input.expectedPaybackDate }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.interestRate !== undefined && { interestRate: input.interestRate != null ? String(input.interestRate) : null }),
        ...(input.notes !== undefined && { notes: input.notes }),
        accrualStoppedOn,
        updatedAt: now,
      })
      .where(and(eq(loansGiven.id, id), eq(loansGiven.workspaceId, workspaceId)))
      .returning();

    await recomputeFromLedger(tx, row, now);

    const [settled] = await tx
      .select()
      .from(loansGiven)
      .where(and(eq(loansGiven.id, id), eq(loansGiven.workspaceId, workspaceId)))
      .limit(1);

    return settled;
  });
}

/** Delete a loan given record (cascades to repayments). */
export async function remove(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);

  const [existing] = await db
    .select({ id: loansGiven.id })
    .from(loansGiven)
    .where(and(eq(loansGiven.id, id), eq(loansGiven.workspaceId, workspaceId)))
    .limit(1);

  if (!existing) throw new Error("Loan not found or unauthorized");

  await db
    .delete(loansGiven)
    .where(and(eq(loansGiven.id, id), eq(loansGiven.workspaceId, workspaceId)));
}

// ─── Repayment Service ───────────────────────────────────────────────────────

/** List repayments for a loan, newest first. */
export async function listRepayments(workspaceId: string, loanId: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(loanId);

  const [loan] = await db
    .select({ id: loansGiven.id })
    .from(loansGiven)
    .where(and(eq(loansGiven.id, loanId), eq(loansGiven.workspaceId, workspaceId)))
    .limit(1);

  if (!loan) throw new Error("Loan not found or unauthorized");

  return db
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.loanId, loanId))
    .orderBy(desc(loanRepayments.repaymentDate), desc(loanRepayments.createdAt));
}

/**
 * Add a repayment, then rederive the balance and status from the ledger.
 *
 * The loan is read *inside* the transaction. Reading it outside and subtracting
 * from that snapshot — as this did — meant two repayments recorded moments
 * apart each wrote a balance computed without the other, silently losing one.
 */
export async function addRepayment(
  workspaceId: string,
  loanId: string,
  input: RepaymentInput,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(loanId);
  loanRepaymentCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);

  const repaymentId = genId();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(loansGiven)
      .where(and(eq(loansGiven.id, loanId), eq(loansGiven.workspaceId, workspaceId)))
      .limit(1);

    if (!loan) throw new Error("Loan not found or unauthorized");

    const [inserted] = await tx
      .insert(loanRepayments)
      .values({
        id: repaymentId,
        loanId,
        userId,
        amount: String(input.amount),
        repaymentDate: input.repaymentDate,
        notes: input.notes ?? null,
        createdAt: now,
      })
      .returning();

    await recomputeFromLedger(tx, loan, now);

    return inserted;
  });
}

/** Delete a repayment, then rederive the balance and status from the ledger. */
export async function removeRepayment(workspaceId: string, loanId: string, repaymentId: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(loanId);
  idSchema.parse(repaymentId);

  const now = new Date();

  await db.transaction(async (tx) => {
    const [loan] = await tx
      .select()
      .from(loansGiven)
      .where(and(eq(loansGiven.id, loanId), eq(loansGiven.workspaceId, workspaceId)))
      .limit(1);

    if (!loan) throw new Error("Loan not found or unauthorized");

    const deleted = await tx
      .delete(loanRepayments)
      .where(and(eq(loanRepayments.id, repaymentId), eq(loanRepayments.loanId, loanId)))
      .returning({ id: loanRepayments.id });

    if (deleted.length === 0) throw new Error("Repayment not found or unauthorized");

    await recomputeFromLedger(tx, loan, now);
  });
}
