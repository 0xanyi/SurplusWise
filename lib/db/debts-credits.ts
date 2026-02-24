import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { debtsCredits, debtBalanceLogs } from "@/db/schema";
import {
  userIdSchema,
  idSchema,
  debtCreditCreateSchema,
  debtCreditUpdateSchema,
  balanceLogCreateSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type DebtType = "credit_card" | "loan" | "mortgage" | "overdraft" | "other";

export interface CreateInput {
  name: string;
  debtType: DebtType;
  lender?: string | null;
  currentBalance: number;
  creditLimit?: number | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  paymentDayOfMonth?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  debtType?: DebtType;
  lender?: string | null;
  currentBalance?: number;
  creditLimit?: number | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  paymentDayOfMonth?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface BalanceLogInput {
  balance: number;
  paymentMade?: number | null;
  notes?: string | null;
  loggedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Debt / Credit Service ───────────────────────────────────────────────────

/** List all debts/credits for a user, optionally only active ones. */
export async function list(userId: string, isActive?: boolean) {
  userIdSchema.parse(userId);
  const conditions = [eq(debtsCredits.userId, userId)];
  if (isActive !== undefined) conditions.push(eq(debtsCredits.isActive, isActive));

  return db
    .select()
    .from(debtsCredits)
    .where(and(...conditions))
    .orderBy(debtsCredits.name);
}

/** Get summary totals for active debts. */
export async function getSummary(userId: string) {
  userIdSchema.parse(userId);

  const [result] = await db
    .select({
      totalBalance: sql<string>`coalesce(sum(${debtsCredits.currentBalance}), 0)`,
      totalMinPayment: sql<string>`coalesce(sum(${debtsCredits.minimumPayment}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(debtsCredits)
    .where(
      and(
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.isActive, true),
      ),
    );

  return {
    totalBalance: Number(result.totalBalance),
    totalMinPayment: Number(result.totalMinPayment),
    count: result.count,
  };
}

/** Create a new debt/credit record. */
export async function create(userId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  debtCreditCreateSchema.parse(input);
  const id = genId();
  const now = new Date();

  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(debtsCredits)
      .values({
        id,
        userId,
        name: input.name,
        debtType: input.debtType,
        lender: input.lender ?? null,
        currentBalance: String(input.currentBalance),
        creditLimit: input.creditLimit != null ? String(input.creditLimit) : null,
        interestRate: input.interestRate != null ? String(input.interestRate) : null,
        minimumPayment: input.minimumPayment != null ? String(input.minimumPayment) : null,
        paymentDayOfMonth: input.paymentDayOfMonth ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        notes: input.notes ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Also create the initial balance log
    await tx.insert(debtBalanceLogs).values({
      id: genId(),
      debtId: id,
      userId,
      balance: String(input.currentBalance),
      notes: "Initial balance",
      loggedAt: now.toISOString().split("T")[0],
      createdAt: now,
    });

    return inserted;
  });

  return row;
}

/** Partial update. Throws if not found / unauthorized. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  debtCreditUpdateSchema.parse(input);

  const [existing] = await db
    .select()
    .from(debtsCredits)
    .where(and(eq(debtsCredits.id, id), eq(debtsCredits.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Debt/credit not found or unauthorized");

  const [row] = await db
    .update(debtsCredits)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.debtType !== undefined && { debtType: input.debtType }),
      ...(input.lender !== undefined && { lender: input.lender }),
      ...(input.currentBalance !== undefined && { currentBalance: String(input.currentBalance) }),
      ...(input.creditLimit !== undefined && { creditLimit: input.creditLimit != null ? String(input.creditLimit) : null }),
      ...(input.interestRate !== undefined && { interestRate: input.interestRate != null ? String(input.interestRate) : null }),
      ...(input.minimumPayment !== undefined && { minimumPayment: input.minimumPayment != null ? String(input.minimumPayment) : null }),
      ...(input.paymentDayOfMonth !== undefined && { paymentDayOfMonth: input.paymentDayOfMonth }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(debtsCredits.id, id), eq(debtsCredits.userId, userId)))
    .returning();
  return row;
}

/** Delete a debt/credit record (cascades to balance logs). */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);

  const [existing] = await db
    .select({ id: debtsCredits.id })
    .from(debtsCredits)
    .where(and(eq(debtsCredits.id, id), eq(debtsCredits.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Debt/credit not found or unauthorized");

  await db
    .delete(debtsCredits)
    .where(and(eq(debtsCredits.id, id), eq(debtsCredits.userId, userId)));
}

// ─── Balance Log Service ─────────────────────────────────────────────────────

/** List balance logs for a debt, newest first. */
export async function listBalanceLogs(userId: string, debtId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);

  // Verify ownership
  const [debt] = await db
    .select({ id: debtsCredits.id })
    .from(debtsCredits)
    .where(and(eq(debtsCredits.id, debtId), eq(debtsCredits.userId, userId)))
    .limit(1);

  if (!debt) throw new Error("Debt/credit not found or unauthorized");

  return db
    .select()
    .from(debtBalanceLogs)
    .where(eq(debtBalanceLogs.debtId, debtId))
    .orderBy(desc(debtBalanceLogs.loggedAt), desc(debtBalanceLogs.createdAt));
}

/** Add a balance log and update the current balance on the debt. */
export async function addBalanceLog(
  userId: string,
  debtId: string,
  input: BalanceLogInput,
) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  balanceLogCreateSchema.parse(input);

  // Verify ownership
  const [debt] = await db
    .select({ id: debtsCredits.id })
    .from(debtsCredits)
    .where(and(eq(debtsCredits.id, debtId), eq(debtsCredits.userId, userId)))
    .limit(1);

  if (!debt) throw new Error("Debt/credit not found or unauthorized");

  const logId = genId();
  const now = new Date();

  const log = await db.transaction(async (tx) => {
    // Insert the log
    const [inserted] = await tx
      .insert(debtBalanceLogs)
      .values({
        id: logId,
        debtId,
        userId,
        balance: String(input.balance),
        paymentMade: input.paymentMade != null ? String(input.paymentMade) : null,
        notes: input.notes ?? null,
        loggedAt: input.loggedAt,
        createdAt: now,
      })
      .returning();

    // Update the current balance on the debt record
    await tx
      .update(debtsCredits)
      .set({
        currentBalance: String(input.balance),
        updatedAt: now,
      })
      .where(and(eq(debtsCredits.id, debtId), eq(debtsCredits.userId, userId)));

    return inserted;
  });

  return log;
}

/** Delete a balance log entry and sync debt current balance to latest snapshot. */
export async function removeBalanceLog(userId: string, debtId: string, logId: string) {
  userIdSchema.parse(userId);
  idSchema.parse(debtId);
  idSchema.parse(logId);

  const [existing] = await db
    .select({ id: debtBalanceLogs.id, debtId: debtBalanceLogs.debtId })
    .from(debtBalanceLogs)
    .where(
      and(
        eq(debtBalanceLogs.id, logId),
        eq(debtBalanceLogs.debtId, debtId),
        eq(debtBalanceLogs.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Balance log not found or unauthorized");

  await db.transaction(async (tx) => {
    const [logCount] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(debtBalanceLogs)
      .where(
        and(
          eq(debtBalanceLogs.debtId, debtId),
          eq(debtBalanceLogs.userId, userId),
        ),
      );

    if (logCount.count <= 1) {
      throw new Error("Cannot delete the only balance log. Add a newer balance update first.");
    }

    await tx
      .delete(debtBalanceLogs)
      .where(
        and(
          eq(debtBalanceLogs.id, logId),
          eq(debtBalanceLogs.debtId, debtId),
          eq(debtBalanceLogs.userId, userId),
        ),
      );

    const [latestRemainingLog] = await tx
      .select({ balance: debtBalanceLogs.balance })
      .from(debtBalanceLogs)
      .where(
        and(
          eq(debtBalanceLogs.debtId, debtId),
          eq(debtBalanceLogs.userId, userId),
        ),
      )
      .orderBy(desc(debtBalanceLogs.loggedAt), desc(debtBalanceLogs.createdAt))
      .limit(1);

    if (!latestRemainingLog) {
      throw new Error("Unable to determine remaining balance after deletion");
    }

    await tx
      .update(debtsCredits)
      .set({
        currentBalance: latestRemainingLog.balance,
        updatedAt: new Date(),
      })
      .where(and(eq(debtsCredits.id, debtId), eq(debtsCredits.userId, userId)));
  });
}
