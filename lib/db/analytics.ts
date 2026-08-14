import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions, outgoingPaymentLogs, debtPayments, debtStatements, recurringOutgoings, debtsCredits, goals } from "@/db/schema";
import { getCostOfBorrowing } from "./debt-statements";
import {
  userIdSchema,
  analyticsQuerySchema,
  workspaceIdSchema,
} from "./validation";
import { getComparisonDateRange, getDateRange } from "./helpers";
import type { ComparisonMode, Period, DateRange } from "./helpers";

// Re-export so existing consumers don't break
export { getDateRange };
export type { Period, DateRange };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CategoryAggregate {
  name: string;
  value: number;
}

export interface DailyTrend {
  date: string;
  expenses: number;
  givings: number;
  income: number;
}

export interface MonthlyTrend {
  month: string;
  expenses: number;
  givings: number;
  income: number;
}

export interface SpendingPrediction {
  projectedMonthlyExpenses: number;
  projectedMonthlyIncome: number;
  daysOfRunway: number | null;
  trendDirection: "improving" | "stable" | "declining";
  insight: string;
}

export interface SafeToSpendBreakdown {
  available: number;
  committedExpenses: number;
  activeGoalsAllocation: number;
  remaining: number;
}

export interface AnalyticsResult {
  totalExpenses: number;
  totalGivings: number;
  totalIncome: number;
  netBalance: number;
  safeToSpend: number;
  safeToSpendBreakdown: SafeToSpendBreakdown;
  spendingPrediction: SpendingPrediction;
  transactionCount: number;
  expensesByCategoryArray: CategoryAggregate[];
  givingsByCategoryArray: CategoryAggregate[];
  incomeByCategoryArray: CategoryAggregate[];
  dailyTrends: DailyTrend[];
  monthlyTrends: MonthlyTrend[];
  period: DateRange;
  previousPeriod: DateRange;
  comparisonMode: ComparisonMode;
  comparisons: {
    expensesChange: number | null;
    givingsChange: number | null;
    incomeChange: number | null;
    netBalanceChange: number | null;
    transactionCountChange: number | null;
  };
  /** Outgoing payments logged this period (included in totalExpenses) */
  outgoingPaymentsTotal: number;
  /** Debt payments logged this period (included in totalExpenses) */
  debtPaymentsTotal: number;
  /**
   * Interest and fees charged on statements closing this period.
   *
   * Deliberately NOT part of totalExpenses: the debt payment is already counted
   * as the expense and the interest is inside it. This is the cost of carrying
   * the debt, reported on its own line.
   */
  costOfBorrowing: CostOfBorrowing;
}

export interface CostOfBorrowing {
  interest: number;
  fees: number;
  total: number;
  statements: number;
}

interface TotalsSummary {
  totalExpenses: number;
  totalGivings: number;
  totalIncome: number;
  transactionCount: number;
}

async function getTotalsForRange(
  userId: string,
  workspaceId: string,
  range: DateRange,
): Promise<TotalsSummary> {
  const where = and(
    eq(transactions.userId, userId),
    eq(transactions.workspaceId, workspaceId),
    gte(transactions.date, range.startDate),
    lte(transactions.date, range.endDate),
  );

  const typeTotals = await db
    .select({
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(where)
    .groupBy(transactions.type);

  let totalExpenses = 0;
  let totalGivings = 0;
  let totalIncome = 0;
  let transactionCount = 0;

  for (const row of typeTotals) {
    const value = Number(row.total);
    transactionCount += row.cnt;
    if (row.type === "expense") totalExpenses = value;
    else if (row.type === "giving") totalGivings = value;
    else if (row.type === "income") totalIncome = value;
  }

  const outgoingPayments = await db
    .select({
      amount: outgoingPaymentLogs.amount,
    })
    .from(outgoingPaymentLogs)
    .innerJoin(
      recurringOutgoings,
      eq(outgoingPaymentLogs.outgoingId, recurringOutgoings.id),
    )
    .where(
      and(
        eq(outgoingPaymentLogs.userId, userId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.type, "expense"),
        gte(outgoingPaymentLogs.paidAt, range.startDate),
        lte(outgoingPaymentLogs.paidAt, range.endDate),
      ),
    );

  const outgoingPaymentsTotal = outgoingPayments.reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );

  const debtPaymentRows = await db
    .select({
      amount: debtPayments.amount,
    })
    .from(debtPayments)
    .innerJoin(debtsCredits, eq(debtPayments.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtPayments.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtPayments.paidAt, range.startDate),
        lte(debtPayments.paidAt, range.endDate),
      ),
    );

  const debtPaymentsTotal = debtPaymentRows.reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );

  return {
    totalExpenses: totalExpenses + outgoingPaymentsTotal + debtPaymentsTotal,
    totalGivings,
    totalIncome,
    transactionCount,
  };
}

function getPercentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}

// ─── Prediction helpers ─────────────────────────────────────────────────────

async function getHistoricalMonthlyAverages(
  userId: string,
  workspaceId: string,
  monthsBack: number = 3,
): Promise<{ avgIncome: number; avgExpenses: number }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);

  const range = {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };

  const where = and(
    eq(transactions.userId, userId),
    eq(transactions.workspaceId, workspaceId),
    gte(transactions.date, range.startDate),
    lte(transactions.date, range.endDate),
  );

  const typeTotals = await db
    .select({
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(where)
    .groupBy(transactions.type);

  let totalExpenses = 0;
  let totalIncome = 0;

  for (const row of typeTotals) {
    const value = Number(row.total);
    if (row.type === "expense") totalExpenses = value;
    else if (row.type === "income") totalIncome = value;
  }

  // Also include outgoing payments and debt payments
  const outgoingPayments = await db
    .select({
      amount: sql<string>`coalesce(sum(${outgoingPaymentLogs.amount}), 0)`,
    })
    .from(outgoingPaymentLogs)
    .innerJoin(recurringOutgoings, eq(outgoingPaymentLogs.outgoingId, recurringOutgoings.id))
    .where(
      and(
        eq(outgoingPaymentLogs.userId, userId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.type, "expense"),
        gte(outgoingPaymentLogs.paidAt, range.startDate),
        lte(outgoingPaymentLogs.paidAt, range.endDate),
      ),
    );

  const debtPaymentTotals = await db
    .select({
      paid: sql<string>`coalesce(sum(${debtPayments.amount}), 0)`,
    })
    .from(debtPayments)
    .innerJoin(debtsCredits, eq(debtPayments.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtPayments.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtPayments.paidAt, range.startDate),
        lte(debtPayments.paidAt, range.endDate),
      ),
    );

  totalExpenses += Number(outgoingPayments[0]?.amount ?? 0);
  totalExpenses += Number(debtPaymentTotals[0]?.paid ?? 0);

  return {
    avgIncome: totalIncome / monthsBack,
    avgExpenses: totalExpenses / monthsBack,
  };
}

function calculateSpendingPrediction(
  currentPeriodIncome: number,
  currentPeriodExpenses: number,
  historicalAvgIncome: number,
  historicalAvgExpenses: number,
  daysInPeriod: number,
): SpendingPrediction {
  // Project monthly based on current period's daily rate, blended with historical average
  const daysInMonth = 30;
  const currentDailyIncome = currentPeriodIncome / daysInPeriod;
  const currentDailyExpenses = currentPeriodExpenses / daysInPeriod;

  // Blend current period with historical (70% current, 30% historical)
  const projectedMonthlyIncome =
    currentDailyIncome * daysInMonth * 0.7 + historicalAvgIncome * 0.3;
  const projectedMonthlyExpenses =
    currentDailyExpenses * daysInMonth * 0.7 + historicalAvgExpenses * 0.3;

  // Determine trend
  const incomeTrend = projectedMonthlyIncome / historicalAvgIncome;
  const expenseTrend = projectedMonthlyExpenses / historicalAvgExpenses;

  let trendDirection: "improving" | "stable" | "declining";
  let insight: string;

  if (incomeTrend > 1.1 && expenseTrend < 0.95) {
    trendDirection = "improving";
    insight = "Income up, spending down — great momentum!";
  } else if (expenseTrend > 1.15) {
    trendDirection = "declining";
    insight = "Spending is trending higher than usual.";
  } else if (incomeTrend < 0.85) {
    trendDirection = "declining";
    insight = "Income is lower than your recent average.";
  } else {
    trendDirection = "stable";
    insight = "Spending and income are tracking normally.";
  }

  // Calculate runway (how many months at current burn rate)
  const monthlyNet = projectedMonthlyIncome - projectedMonthlyExpenses;
  const daysOfRunway =
    monthlyNet > 0
      ? null // Positive cash flow = infinite runway
      : monthlyNet < 0
        ? Math.max(0, Math.round((currentPeriodIncome - currentPeriodExpenses) / (Math.abs(monthlyNet) / daysInMonth) * 30))
        : null;

  return {
    projectedMonthlyExpenses: Math.round(projectedMonthlyExpenses * 100) / 100,
    projectedMonthlyIncome: Math.round(projectedMonthlyIncome * 100) / 100,
    daysOfRunway,
    trendDirection,
    insight,
  };
}

async function getActiveGoalsAllocation(
  userId: string,
  workspaceId: string,
): Promise<number> {
  const activeGoals = await db
    .select({
      targetAmount: goals.targetAmount,
      currentAmount: goals.currentAmount,
    })
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.workspaceId, workspaceId),
        eq(goals.isActive, true),
      ),
    );

  // Calculate remaining to save across all active goals
  return activeGoals.reduce((sum, goal) => {
    const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));
    return sum + remaining;
  }, 0);
}

async function getCommittedMonthlyExpenses(
  userId: string,
  workspaceId: string,
): Promise<number> {
  // Get active recurring outgoings
  const outgoings = await db
    .select({
      amount: recurringOutgoings.amount,
    })
    .from(recurringOutgoings)
    .where(
      and(
        eq(recurringOutgoings.userId, userId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.type, "expense"),
        eq(recurringOutgoings.isActive, true),
        eq(recurringOutgoings.frequency, "monthly"),
      ),
    );

  const totalOutgoings = outgoings.reduce((sum, o) => sum + Number(o.amount), 0);

  // Minimum debt payments, preferring the latest statement's actual figure over
  // the estimate typed in at setup so this matches the debts page total.
  const latestStatement = db
    .selectDistinctOn([debtStatements.debtId], {
      debtId: debtStatements.debtId,
      minimumPayment: debtStatements.minimumPayment,
    })
    .from(debtStatements)
    .where(eq(debtStatements.userId, userId))
    .orderBy(desc(debtStatements.debtId), desc(debtStatements.periodEnd))
    .as("latest_statement");

  const debts = await db
    .select({
      minimumPayment: sql<string | null>`coalesce(${latestStatement.minimumPayment}, ${debtsCredits.minimumPayment})`,
    })
    .from(debtsCredits)
    .leftJoin(latestStatement, eq(latestStatement.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtsCredits.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        eq(debtsCredits.isActive, true),
      ),
    );

  const totalMinPayments = debts.reduce(
    (sum, d) => sum + (d.minimumPayment ? Number(d.minimumPayment) : 0),
    0,
  );

  return totalOutgoings + totalMinPayments;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Full analytics payload that mirrors the existing `/api/analytics` response.
 * All aggregation is done in SQL where possible.
 *
 * Now also includes:
 * - Logged outgoing payments as expenses (category: "Recurring Outgoings" or their outgoing category)
 * - Debt payments as expenses (category: "Debt Payments")
 * - Cost of borrowing (statement interest + fees), reported beside expenses, never inside them
 */
export async function getAnalytics(
  userId: string,
  workspaceId: string,
  period: Period,
  custom?: Partial<DateRange>,
  comparisonMode: ComparisonMode = "previous-period",
): Promise<AnalyticsResult> {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  analyticsQuerySchema.parse({
    period,
    startDate: custom?.startDate,
    endDate: custom?.endDate,
    comparison: comparisonMode,
  });
  const range = getDateRange(period, custom);
  const previousRange = getComparisonDateRange(range, comparisonMode);

  const where = and(
    eq(transactions.userId, userId),
    eq(transactions.workspaceId, workspaceId),
    gte(transactions.date, range.startDate),
    lte(transactions.date, range.endDate),
  );

  // 1. Totals by type (single query)
  const typeTotals = await db
    .select({
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(where)
    .groupBy(transactions.type);

  let totalExpenses = 0;
  let totalGivings = 0;
  let totalIncome = 0;
  let transactionCount = 0;

  for (const row of typeTotals) {
    const v = Number(row.total);
    transactionCount += row.cnt;
    if (row.type === "expense") totalExpenses = v;
    else if (row.type === "giving") totalGivings = v;
    else if (row.type === "income") totalIncome = v;
  }

  // 2. By-category aggregates (single query)
  const catAggs = await db
    .select({
      type: transactions.type,
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(where)
    .groupBy(transactions.type, transactions.category);

  const expensesByCategoryArray: CategoryAggregate[] = [];
  const givingsByCategoryArray: CategoryAggregate[] = [];
  const incomeByCategoryArray: CategoryAggregate[] = [];

  for (const row of catAggs) {
    const entry = { name: row.category, value: Number(row.total) };
    if (row.type === "expense") expensesByCategoryArray.push(entry);
    else if (row.type === "giving") givingsByCategoryArray.push(entry);
    else if (row.type === "income") incomeByCategoryArray.push(entry);
  }

  // 3. Outgoing payment logs as expenses
  const outgoingPayments = await db
    .select({
      amount: outgoingPaymentLogs.amount,
      paidAt: outgoingPaymentLogs.paidAt,
      category: recurringOutgoings.category,
    })
    .from(outgoingPaymentLogs)
    .innerJoin(
      recurringOutgoings,
      eq(outgoingPaymentLogs.outgoingId, recurringOutgoings.id),
    )
    .where(
      and(
        eq(outgoingPaymentLogs.userId, userId),
        eq(recurringOutgoings.workspaceId, workspaceId),
        eq(recurringOutgoings.type, "expense"),
        gte(outgoingPaymentLogs.paidAt, range.startDate),
        lte(outgoingPaymentLogs.paidAt, range.endDate),
      ),
    );

  let outgoingPaymentsTotal = 0;
  const outgoingCategoryTotals = new Map<string, number>();
  for (const row of outgoingPayments) {
    const amount = Number(row.amount);
    outgoingPaymentsTotal += amount;
    const cat = row.category ?? "Recurring Outgoings";
    outgoingCategoryTotals.set(cat, (outgoingCategoryTotals.get(cat) ?? 0) + amount);
  }

  // Merge outgoing payments into expense categories
  for (const [cat, total] of outgoingCategoryTotals) {
    const existing = expensesByCategoryArray.find((c) => c.name === cat);
    if (existing) {
      existing.value += total;
    } else {
      expensesByCategoryArray.push({ name: cat, value: total });
    }
  }
  totalExpenses += outgoingPaymentsTotal;

  // 4. Debt payments as expenses.
  //
  // The payment is the expense, not the interest on the statement. Sika counts
  // cash leaving the bank; the interest charged is already inside that figure,
  // so adding it here would double-count. Interest is reported separately as
  // cost of borrowing (see `getCostOfBorrowing` in lib/db/debt-statements.ts).
  const debtPaymentRows = await db
    .select({
      amount: debtPayments.amount,
      paidAt: debtPayments.paidAt,
    })
    .from(debtPayments)
    .innerJoin(debtsCredits, eq(debtPayments.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtPayments.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtPayments.paidAt, range.startDate),
        lte(debtPayments.paidAt, range.endDate),
      ),
    );

  let debtPaymentsTotal = 0;
  for (const row of debtPaymentRows) {
    debtPaymentsTotal += Number(row.amount);
  }

  if (debtPaymentsTotal > 0) {
    const existing = expensesByCategoryArray.find((c) => c.name === "Debt Payments");
    if (existing) {
      existing.value += debtPaymentsTotal;
    } else {
      expensesByCategoryArray.push({ name: "Debt Payments", value: debtPaymentsTotal });
    }
    totalExpenses += debtPaymentsTotal;
  }

  // Sort each descending by value
  expensesByCategoryArray.sort((a, b) => b.value - a.value);
  givingsByCategoryArray.sort((a, b) => b.value - a.value);
  incomeByCategoryArray.sort((a, b) => b.value - a.value);

  // 5. Daily trends (single query — transactions only for now)
  const dailyRows = await db
    .select({
      date: transactions.date,
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(where)
    .groupBy(transactions.date, transactions.type)
    .orderBy(transactions.date);

  const dailyMap = new Map<string, DailyTrend>();
  for (const row of dailyRows) {
    let entry = dailyMap.get(row.date);
    if (!entry) {
      entry = { date: row.date, expenses: 0, givings: 0, income: 0 };
      dailyMap.set(row.date, entry);
    }
    const v = Number(row.total);
    if (row.type === "expense") entry.expenses = v;
    else if (row.type === "giving") entry.givings = v;
    else if (row.type === "income") entry.income = v;
  }

  // Merge outgoing payments into daily trends
  for (const row of outgoingPayments) {
    const date = row.paidAt;
    let entry = dailyMap.get(date);
    if (!entry) {
      entry = { date, expenses: 0, givings: 0, income: 0 };
      dailyMap.set(date, entry);
    }
    entry.expenses += Number(row.amount);
  }

  // Merge debt payments into daily trends
  for (const row of debtPaymentRows) {
    const date = row.paidAt;
    let entry = dailyMap.get(date);
    if (!entry) {
      entry = { date, expenses: 0, givings: 0, income: 0 };
      dailyMap.set(date, entry);
    }
    entry.expenses += Number(row.amount);
  }

  const dailyTrends = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // 6. Monthly trends (derived from daily for consistency)
  const monthlyMap = new Map<string, MonthlyTrend>();
  for (const day of dailyTrends) {
    const monthKey = day.date.slice(0, 7); // YYYY-MM
    let entry = monthlyMap.get(monthKey);
    if (!entry) {
      entry = { month: monthKey, expenses: 0, givings: 0, income: 0 };
      monthlyMap.set(monthKey, entry);
    }
    entry.expenses += day.expenses;
    entry.givings += day.givings;
    entry.income += day.income;
  }
  const monthlyTrends = Array.from(monthlyMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  const previousTotals = await getTotalsForRange(userId, workspaceId, previousRange);
  const netBalance = totalIncome - totalExpenses - totalGivings;
  const previousNetBalance =
    previousTotals.totalIncome - previousTotals.totalExpenses - previousTotals.totalGivings;

  // Calculate spending prediction
  const { avgIncome: historicalAvgIncome, avgExpenses: historicalAvgExpenses } =
    await getHistoricalMonthlyAverages(userId, workspaceId);
  const daysInPeriod = Math.max(1, Math.round(
    (new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ));
  const spendingPrediction = calculateSpendingPrediction(
    totalIncome,
    totalExpenses,
    historicalAvgIncome,
    historicalAvgExpenses,
    daysInPeriod,
  );

  const costOfBorrowing = await getCostOfBorrowing(userId, workspaceId, range);

  // Calculate safe-to-spend breakdown
  const committedExpenses = await getCommittedMonthlyExpenses(userId, workspaceId);
  const activeGoalsAllocation = await getActiveGoalsAllocation(userId, workspaceId);
  const safeToSpend = totalIncome - totalExpenses - totalGivings;
  const safeToSpendBreakdown: SafeToSpendBreakdown = {
    available: safeToSpend,
    committedExpenses,
    activeGoalsAllocation,
    remaining: Math.max(0, safeToSpend - committedExpenses - activeGoalsAllocation),
  };

  return {
    totalExpenses,
    totalGivings,
    totalIncome,
    netBalance,
    safeToSpend,
    safeToSpendBreakdown,
    spendingPrediction,
    transactionCount,
    expensesByCategoryArray,
    givingsByCategoryArray,
    incomeByCategoryArray,
    dailyTrends,
    monthlyTrends,
    period: range,
    previousPeriod: previousRange,
    comparisonMode,
    comparisons: {
      expensesChange: getPercentChange(totalExpenses, previousTotals.totalExpenses),
      givingsChange: getPercentChange(totalGivings, previousTotals.totalGivings),
      incomeChange: getPercentChange(totalIncome, previousTotals.totalIncome),
      netBalanceChange: getPercentChange(netBalance, previousNetBalance),
      transactionCountChange: getPercentChange(transactionCount, previousTotals.transactionCount),
    },
    outgoingPaymentsTotal,
    debtPaymentsTotal,
    costOfBorrowing,
  };
}
