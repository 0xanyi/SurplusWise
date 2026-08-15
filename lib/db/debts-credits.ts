import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  debtsCredits,
  debtBalanceLogs,
  debtStatements,
  financialAccounts,
} from "@/db/schema";
import * as financialAccountsService from "./financial-accounts";
import {
  userIdSchema,
  idSchema,
  debtCreditCreateSchema,
  debtCreditUpdateSchema,
  balanceLogCreateSchema,
  workspaceIdSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type DebtType = "credit_card" | "loan" | "mortgage" | "overdraft" | "other";

export interface CreateInput {
  name: string;
  debtType: DebtType;
  financialAccountId?: string | null;
  lender?: string | null;
  currentBalance: number;
  creditLimit?: number | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  minPaymentPercent?: number | null;
  minPaymentFloor?: number | null;
  paymentDayOfMonth?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  debtType?: DebtType;
  financialAccountId?: string | null;
  lender?: string | null;
  currentBalance?: number;
  creditLimit?: number | null;
  interestRate?: number | null;
  minimumPayment?: number | null;
  minPaymentPercent?: number | null;
  minPaymentFloor?: number | null;
  paymentDayOfMonth?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface BalanceLogInput {
  balance: number;
  notes?: string | null;
  loggedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

async function assertLinkableAccount(
  userId: string,
  workspaceId: string,
  accountId: string,
  debtId?: string,
) {
  const account = await financialAccountsService.assertInWorkspace(userId, workspaceId, accountId);
  if (account.accountClass !== "liability") {
    throw new Error("Only liability accounts can be linked to a debt");
  }

  const conditions = [eq(debtsCredits.financialAccountId, accountId)];
  if (debtId) conditions.push(ne(debtsCredits.id, debtId));
  const [existingLink] = await db
    .select({ id: debtsCredits.id })
    .from(debtsCredits)
    .where(and(...conditions))
    .limit(1);
  if (existingLink) throw new Error("Financial account is already linked to another debt");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Point `current_balance` at the newest evidence, whichever table it came from.
 *
 * Two sources can claim it: a statement's closing balance (the issuer's figure)
 * and an ad-hoc snapshot (the user's reading). The newer date wins, and a
 * statement wins a tie — on the day a statement closes, the issuer's number is
 * the better one. Without this, logging a backdated snapshot would silently
 * overwrite a more recent statement.
 */
export async function syncCurrentBalance(tx: Tx, userId: string, debtId: string) {
  const [statement] = await tx
    .select({ balance: debtStatements.closingBalance, at: debtStatements.periodEnd })
    .from(debtStatements)
    .where(and(eq(debtStatements.debtId, debtId), eq(debtStatements.userId, userId)))
    .orderBy(desc(debtStatements.periodEnd))
    .limit(1);

  const [snapshot] = await tx
    .select({ balance: debtBalanceLogs.balance, at: debtBalanceLogs.loggedAt })
    .from(debtBalanceLogs)
    .where(and(eq(debtBalanceLogs.debtId, debtId), eq(debtBalanceLogs.userId, userId)))
    .orderBy(desc(debtBalanceLogs.loggedAt), desc(debtBalanceLogs.createdAt))
    .limit(1);

  const winner =
    statement && snapshot
      ? snapshot.at > statement.at
        ? snapshot
        : statement
      : (statement ?? snapshot);

  if (!winner) return;

  await tx
    .update(debtsCredits)
    .set({ currentBalance: winner.balance, updatedAt: new Date() })
    .where(and(eq(debtsCredits.id, debtId), eq(debtsCredits.userId, userId)));
}

// ─── Debt / Credit Service ───────────────────────────────────────────────────

/** List all debts/credits for a user, optionally only active ones. */
export async function list(userId: string, workspaceId: string, isActive?: boolean) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const conditions = [eq(debtsCredits.userId, userId), eq(debtsCredits.workspaceId, workspaceId)];
  if (isActive !== undefined) conditions.push(eq(debtsCredits.isActive, isActive));

  return db
    .select()
    .from(debtsCredits)
    .where(and(...conditions))
    .orderBy(debtsCredits.name);
}

/** Fetch a single debt. Throws if not found / not the user's. */
export async function getById(userId: string, workspaceId: string, id: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);

  const [row] = await db
    .select()
    .from(debtsCredits)
    .where(
      and(
        eq(debtsCredits.id, id),
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Debt/credit not found or unauthorized");
  return row;
}

/**
 * Summary totals for active debts.
 *
 * The minimum payment prefers the latest statement's actual figure and falls
 * back to the debt's configured estimate, so the total reflects what is really
 * being asked for this month rather than a number typed in once at setup.
 */
export async function getSummary(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);

  const latestStatement = db
    .selectDistinctOn([debtStatements.debtId], {
      debtId: debtStatements.debtId,
      minimumPayment: debtStatements.minimumPayment,
    })
    .from(debtStatements)
    .where(eq(debtStatements.userId, userId))
    .orderBy(desc(debtStatements.debtId), desc(debtStatements.periodEnd))
    .as("latest_statement");

  const [result] = await db
    .select({
      totalBalance: sql<string>`coalesce(sum(${debtsCredits.currentBalance}), 0)`,
      netWorthBalance: sql<string>`coalesce(sum(
        case when ${financialAccounts.id} is not null
          and ${financialAccounts.isActive} = true
          and ${financialAccounts.accountClass} = 'liability'
        then 0 else ${debtsCredits.currentBalance} end
      ), 0)`,
      totalMinPayment: sql<string>`coalesce(sum(coalesce(${latestStatement.minimumPayment}, ${debtsCredits.minimumPayment})), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(debtsCredits)
    .leftJoin(latestStatement, eq(latestStatement.debtId, debtsCredits.id))
    .leftJoin(financialAccounts, eq(financialAccounts.id, debtsCredits.financialAccountId))
    .where(
      and(
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        eq(debtsCredits.isActive, true),
      ),
    );

  return {
    totalBalance: Number(result.totalBalance),
    netWorthBalance: Number(result.netWorthBalance),
    totalMinPayment: Number(result.totalMinPayment),
    count: result.count,
  };
}

/** Create a new debt/credit record. */
export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const validInput = debtCreditCreateSchema.parse(input);
  if (validInput.financialAccountId) {
    await assertLinkableAccount(userId, workspaceId, validInput.financialAccountId);
  }
  const id = genId();
  const now = new Date();

  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(debtsCredits)
      .values({
        id,
        userId,
        workspaceId,
        financialAccountId: validInput.financialAccountId ?? null,
        name: input.name,
        debtType: input.debtType,
        lender: input.lender ?? null,
        currentBalance: String(input.currentBalance),
        creditLimit: input.creditLimit != null ? String(input.creditLimit) : null,
        interestRate: input.interestRate != null ? String(input.interestRate) : null,
        minimumPayment: input.minimumPayment != null ? String(input.minimumPayment) : null,
        minPaymentPercent:
          input.minPaymentPercent != null ? String(input.minPaymentPercent) : undefined,
        minPaymentFloor: input.minPaymentFloor != null ? String(input.minPaymentFloor) : null,
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
export async function update(userId: string, workspaceId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const validInput = debtCreditUpdateSchema.parse(input);

  const [existing] = await db
    .select()
    .from(debtsCredits)
    .where(
      and(
        eq(debtsCredits.id, id),
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Debt/credit not found or unauthorized");
  if (validInput.financialAccountId) {
    await assertLinkableAccount(userId, workspaceId, validInput.financialAccountId, id);
  }

  const [row] = await db
    .update(debtsCredits)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.debtType !== undefined && { debtType: input.debtType }),
      ...(input.financialAccountId !== undefined && {
        financialAccountId: input.financialAccountId,
      }),
      ...(input.lender !== undefined && { lender: input.lender }),
      ...(input.currentBalance !== undefined && { currentBalance: String(input.currentBalance) }),
      ...(input.creditLimit !== undefined && { creditLimit: input.creditLimit != null ? String(input.creditLimit) : null }),
      ...(input.interestRate !== undefined && { interestRate: input.interestRate != null ? String(input.interestRate) : null }),
      ...(input.minimumPayment !== undefined && { minimumPayment: input.minimumPayment != null ? String(input.minimumPayment) : null }),
      ...(input.minPaymentPercent !== undefined && { minPaymentPercent: input.minPaymentPercent != null ? String(input.minPaymentPercent) : null }),
      ...(input.minPaymentFloor !== undefined && { minPaymentFloor: input.minPaymentFloor != null ? String(input.minPaymentFloor) : null }),
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
export async function remove(userId: string, workspaceId: string, id: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);

  const [existing] = await db
    .select({ id: debtsCredits.id })
    .from(debtsCredits)
    .where(
      and(
        eq(debtsCredits.id, id),
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Debt/credit not found or unauthorized");

  await db
    .delete(debtsCredits)
    .where(
      and(
        eq(debtsCredits.id, id),
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
      ),
    );
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
        notes: input.notes ?? null,
        loggedAt: input.loggedAt,
        createdAt: now,
      })
      .returning();

    await syncCurrentBalance(tx, userId, debtId);

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

    const [statementCount] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(debtStatements)
      .where(
        and(eq(debtStatements.debtId, debtId), eq(debtStatements.userId, userId)),
      );

    // Deleting the last snapshot is only a problem when nothing else can tell us
    // the balance. A recorded statement can, so the guard no longer applies.
    if (logCount.count <= 1 && statementCount.count === 0) {
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

    await syncCurrentBalance(tx, userId, debtId);
  });
}
