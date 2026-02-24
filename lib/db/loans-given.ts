import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loansGiven, loanRepayments } from "@/db/schema";
import {
  userIdSchema,
  idSchema,
  loanGivenCreateSchema,
  loanGivenUpdateSchema,
  loanRepaymentCreateSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type LoanStatus = "active" | "partially_repaid" | "fully_repaid" | "defaulted";

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
  outstandingBalance?: number;
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

// ─── Loans Given Service ─────────────────────────────────────────────────────

/** List all loans given by a user, optionally filtered by status. */
export async function list(userId: string, status?: LoanStatus) {
  userIdSchema.parse(userId);
  const conditions = [eq(loansGiven.userId, userId)];
  if (status !== undefined) conditions.push(eq(loansGiven.status, status));

  return db
    .select()
    .from(loansGiven)
    .where(and(...conditions))
    .orderBy(loansGiven.borrowerName);
}

/** Get summary totals for active loans (receivables). */
export async function getSummary(userId: string) {
  userIdSchema.parse(userId);

  const [result] = await db
    .select({
      totalLent: sql<string>`coalesce(sum(${loansGiven.amount}), 0)`,
      totalOutstanding: sql<string>`coalesce(sum(${loansGiven.outstandingBalance}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(loansGiven)
    .where(
      and(
        eq(loansGiven.userId, userId),
        eq(loansGiven.status, "active"),
      ),
    );

  return {
    totalLent: Number(result.totalLent),
    totalOutstanding: Number(result.totalOutstanding),
    count: result.count,
  };
}

/** Create a new loan given record. */
export async function create(userId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  loanGivenCreateSchema.parse(input);
  const id = genId();
  const now = new Date();

  const [row] = await db
    .insert(loansGiven)
    .values({
      id,
      userId,
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

/** Partial update. Throws if not found / unauthorized. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  loanGivenUpdateSchema.parse(input);

  const [existing] = await db
    .select()
    .from(loansGiven)
    .where(and(eq(loansGiven.id, id), eq(loansGiven.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Loan not found or unauthorized");

  const [row] = await db
    .update(loansGiven)
    .set({
      ...(input.borrowerName !== undefined && { borrowerName: input.borrowerName }),
      ...(input.amount !== undefined && { amount: String(input.amount) }),
      ...(input.outstandingBalance !== undefined && { outstandingBalance: String(input.outstandingBalance) }),
      ...(input.loanDate !== undefined && { loanDate: input.loanDate }),
      ...(input.expectedPaybackDate !== undefined && { expectedPaybackDate: input.expectedPaybackDate }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.interestRate !== undefined && { interestRate: input.interestRate != null ? String(input.interestRate) : null }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date(),
    })
    .where(and(eq(loansGiven.id, id), eq(loansGiven.userId, userId)))
    .returning();
  return row;
}

/** Delete a loan given record (cascades to repayments). */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);

  const [existing] = await db
    .select({ id: loansGiven.id })
    .from(loansGiven)
    .where(and(eq(loansGiven.id, id), eq(loansGiven.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Loan not found or unauthorized");

  await db
    .delete(loansGiven)
    .where(and(eq(loansGiven.id, id), eq(loansGiven.userId, userId)));
}

// ─── Repayment Service ───────────────────────────────────────────────────────

/** List repayments for a loan, newest first. */
export async function listRepayments(userId: string, loanId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(loanId);

  // Verify ownership
  const [loan] = await db
    .select({ id: loansGiven.id })
    .from(loansGiven)
    .where(and(eq(loansGiven.id, loanId), eq(loansGiven.userId, userId)))
    .limit(1);

  if (!loan) throw new Error("Loan not found or unauthorized");

  return db
    .select()
    .from(loanRepayments)
    .where(eq(loanRepayments.loanId, loanId))
    .orderBy(desc(loanRepayments.repaymentDate), desc(loanRepayments.createdAt));
}

/** Add a repayment and update outstanding balance / status. */
export async function addRepayment(
  userId: string,
  loanId: string,
  input: RepaymentInput,
) {
  userIdSchema.parse(userId);
  idSchema.parse(loanId);
  loanRepaymentCreateSchema.parse(input);

  // Verify ownership
  const [loan] = await db
    .select({ id: loansGiven.id, amount: loansGiven.amount, outstandingBalance: loansGiven.outstandingBalance })
    .from(loansGiven)
    .where(and(eq(loansGiven.id, loanId), eq(loansGiven.userId, userId)))
    .limit(1);

  if (!loan) throw new Error("Loan not found or unauthorized");

  const repaymentId = genId();
  const now = new Date();

  const repayment = await db.transaction(async (tx) => {
    // Insert the repayment
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

    // Calculate new outstanding balance
    const newOutstanding = Math.max(0, Number(loan.outstandingBalance) - input.amount);
    const newStatus: LoanStatus = newOutstanding <= 0 ? "fully_repaid" : "partially_repaid";

    // Update the loan record
    await tx
      .update(loansGiven)
      .set({
        outstandingBalance: String(newOutstanding),
        status: newStatus,
        updatedAt: now,
      })
      .where(and(eq(loansGiven.id, loanId), eq(loansGiven.userId, userId)));

    return inserted;
  });

  return repayment;
}

/** Delete a repayment and recalculate outstanding balance / status. */
export async function removeRepayment(userId: string, loanId: string, repaymentId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(loanId);
  idSchema.parse(repaymentId);

  const [existing] = await db
    .select({ id: loanRepayments.id, loanId: loanRepayments.loanId })
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.id, repaymentId),
        eq(loanRepayments.loanId, loanId),
        eq(loanRepayments.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Repayment not found or unauthorized");

  await db.transaction(async (tx) => {
    // Delete the repayment
    await tx
      .delete(loanRepayments)
      .where(
        and(
          eq(loanRepayments.id, repaymentId),
          eq(loanRepayments.loanId, loanId),
          eq(loanRepayments.userId, userId),
        ),
      );

    // Get the loan's original amount
    const [loan] = await tx
      .select({ amount: loansGiven.amount })
      .from(loansGiven)
      .where(and(eq(loansGiven.id, loanId), eq(loansGiven.userId, userId)))
      .limit(1);

    if (!loan) throw new Error("Loan not found or unauthorized");

    // Sum remaining repayments
    const [repaymentSum] = await tx
      .select({
        total: sql<string>`coalesce(sum(${loanRepayments.amount}), 0)`,
      })
      .from(loanRepayments)
      .where(
        and(
          eq(loanRepayments.loanId, loanId),
          eq(loanRepayments.userId, userId),
        ),
      );

    const totalRepaid = Number(repaymentSum.total);
    const originalAmount = Number(loan.amount);
    const newOutstanding = Math.max(0, originalAmount - totalRepaid);

    // Determine new status
    let newStatus: LoanStatus;
    if (newOutstanding <= 0) {
      newStatus = "fully_repaid";
    } else if (totalRepaid > 0) {
      newStatus = "partially_repaid";
    } else {
      newStatus = "active";
    }

    // Update the loan record
    await tx
      .update(loansGiven)
      .set({
        outstandingBalance: String(newOutstanding),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(loansGiven.id, loanId), eq(loansGiven.userId, userId)));
  });
}
