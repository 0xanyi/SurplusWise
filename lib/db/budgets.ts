import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { budgets, transactions } from "@/db/schema";
import {
  userIdSchema,
  idSchema,
  budgetCreateSchema,
  budgetUpdateSchema,
  budgetPeriodSchema,
  workspaceIdSchema,
} from "./validation";
import { computeBudgetUsage } from "./helpers";
import { getNextBudgetRange, getRolledBudgetAmount } from "@/lib/budget-periods";

// ─── Types ───────────────────────────────────────────────────────────────────

type TransactionType = "expense" | "giving" | "income";
type BudgetPeriod = "monthly" | "quarterly" | "yearly";

export interface CreateInput {
  category: string;
  amount: number;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  type: TransactionType;
}

export interface UpdateInput {
  category?: string;
  amount?: number;
  period?: BudgetPeriod;
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  isActive?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

// ─── Service functions ───────────────────────────────────────────────────────

/** List budgets, optionally only active ones. */
export async function list(userId: string, workspaceId: string, isActive?: boolean) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const conditions = [eq(budgets.userId, userId), eq(budgets.workspaceId, workspaceId)];
  if (isActive !== undefined) conditions.push(eq(budgets.isActive, isActive));

  return db
    .select()
    .from(budgets)
    .where(and(...conditions));
}

/** Create a new budget. */
export async function create(userId: string, workspaceId: string, input: CreateInput) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  budgetCreateSchema.parse(input);
  const id = genId();
  const now = new Date();
  const [row] = await db
    .insert(budgets)
    .values({
      id,
      userId,
      workspaceId,
      category: input.category,
      amount: String(input.amount),
      period: input.period,
      startDate: input.startDate,
      endDate: input.endDate,
      type: input.type,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** Create the same budget for its next calendar period and archive this occurrence. */
export async function copyForward(
  userId: string,
  workspaceId: string,
  id: string,
  options: { carryRemaining?: boolean } = {},
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.id, id),
          eq(budgets.userId, userId),
          eq(budgets.workspaceId, workspaceId),
        ),
      )
      .for("update")
      .limit(1);

    if (!existing) throw new Error("Budget not found or unauthorized");
    if (!existing.isActive) throw new Error("Budget has already been copied forward");
    if (options.carryRemaining && existing.type === "income") {
      throw new Error("Rollover is only available for expense and giving budgets");
    }

    const { startDate, endDate } = getNextBudgetRange(existing.endDate, existing.period);
    const [conflict] = await tx
      .select({ id: budgets.id })
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.workspaceId, workspaceId),
          eq(budgets.category, existing.category),
          eq(budgets.type, existing.type),
          eq(budgets.startDate, startDate),
          eq(budgets.endDate, endDate),
        ),
      )
      .limit(1);

    if (conflict) throw new Error("A budget for the next period already exists");

    let nextAmount = Number(existing.amount);
    if (options.carryRemaining) {
      const [{ total }] = await tx
        .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.workspaceId, workspaceId),
            eq(transactions.category, existing.category),
            eq(transactions.type, existing.type),
            gte(transactions.date, existing.startDate),
            lte(transactions.date, existing.endDate),
          ),
        );
      nextAmount = getRolledBudgetAmount(nextAmount, nextAmount - Number(total));
    }

    const now = new Date();
    const [nextBudget] = await tx
      .insert(budgets)
      .values({
        id: genId(),
        userId,
        workspaceId,
        category: existing.category,
        amount: String(nextAmount),
        period: existing.period,
        startDate,
        endDate,
        type: existing.type,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx
      .update(budgets)
      .set({ isActive: false, updatedAt: now })
      .where(eq(budgets.id, existing.id));

    return nextBudget;
  });
}

/** Partial update. Throws if not found / unauthorized. */
export async function update(userId: string, id: string, input: UpdateInput) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  budgetUpdateSchema.parse(input);
  const [existing] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Budget not found or unauthorized");

  // Validate merged effective date range when a single date field is updated
  const effectiveStart = input.startDate ?? existing.startDate;
  const effectiveEnd = input.endDate ?? existing.endDate;
  if (effectiveStart > effectiveEnd) {
    throw new Error("startDate must be on or before endDate");
  }

  const [row] = await db
    .update(budgets)
    .set({
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: String(input.amount) }),
      ...(input.period !== undefined && { period: input.period }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate !== undefined && { endDate: input.endDate }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .returning();
  return row;
}

/** Delete a budget. Throws if not found / unauthorized. */
export async function remove(userId: string, id: string) {
  userIdSchema.parse(userId);
  idSchema.parse(id);
  const [existing] = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .limit(1);

  if (!existing) throw new Error("Budget not found or unauthorized");

  await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
}

/**
 * Active budgets enriched with actual spending from transactions.
 * Matches the existing Convex `getWithSpending` shape.
 */
export async function getWithSpending(
  userId: string,
  workspaceId: string,
  period?: BudgetPeriod,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (period) budgetPeriodSchema.parse(period);

  // 1. Fetch active budgets
  const conditions = [
    eq(budgets.userId, userId),
    eq(budgets.workspaceId, workspaceId),
    eq(budgets.isActive, true),
  ];
  if (period) conditions.push(eq(budgets.period, period));

  const activeBudgets = await db
    .select()
    .from(budgets)
    .where(and(...conditions));

  if (activeBudgets.length === 0) return [];

  // 2. For each budget, compute the sum of matching transactions
  const results = await Promise.all(
    activeBudgets.map(async (budget) => {
      const [{ total }] = await db
        .select({
          total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.workspaceId, workspaceId),
            eq(transactions.category, budget.category),
            eq(transactions.type, budget.type),
            gte(transactions.date, budget.startDate),
            lte(transactions.date, budget.endDate),
          ),
        );

      const spent = Number(total);
      const budgetAmount = Number(budget.amount);
      const usage = computeBudgetUsage(budgetAmount, spent);

      return { ...budget, ...usage };
    }),
  );

  return results;
}
