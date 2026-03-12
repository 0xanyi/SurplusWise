import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions, outgoingPaymentLogs, debtBalanceLogs, recurringOutgoings, debtsCredits } from "@/db/schema";
import {
  userIdSchema,
  analyticsQuerySchema,
  workspaceIdSchema,
} from "./validation";
import { getDateRange, getPreviousDateRange } from "./helpers";
import type { Period, DateRange } from "./helpers";

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

export interface AnalyticsResult {
  totalExpenses: number;
  totalGivings: number;
  totalIncome: number;
  netBalance: number;
  safeToSpend: number;
  transactionCount: number;
  expensesByCategoryArray: CategoryAggregate[];
  givingsByCategoryArray: CategoryAggregate[];
  incomeByCategoryArray: CategoryAggregate[];
  dailyTrends: DailyTrend[];
  monthlyTrends: MonthlyTrend[];
  period: DateRange;
  previousPeriod: DateRange;
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
        gte(outgoingPaymentLogs.paidAt, range.startDate),
        lte(outgoingPaymentLogs.paidAt, range.endDate),
      ),
    );

  const outgoingPaymentsTotal = outgoingPayments.reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );

  const debtPayments = await db
    .select({
      paymentMade: debtBalanceLogs.paymentMade,
    })
    .from(debtBalanceLogs)
    .innerJoin(debtsCredits, eq(debtBalanceLogs.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtBalanceLogs.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtBalanceLogs.loggedAt, range.startDate),
        lte(debtBalanceLogs.loggedAt, range.endDate),
        sql`${debtBalanceLogs.paymentMade} IS NOT NULL AND ${debtBalanceLogs.paymentMade} > 0`,
      ),
    );

  const debtPaymentsTotal = debtPayments.reduce(
    (sum, row) => sum + Number(row.paymentMade ?? 0),
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

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Full analytics payload that mirrors the existing `/api/analytics` response.
 * All aggregation is done in SQL where possible.
 *
 * Now also includes:
 * - Logged outgoing payments as expenses (category: "Recurring Outgoings" or their outgoing category)
 * - Debt balance-log payments as expenses (category: "Debt Payments")
 */
export async function getAnalytics(
  userId: string,
  workspaceId: string,
  period: Period,
  custom?: Partial<DateRange>,
): Promise<AnalyticsResult> {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  analyticsQuerySchema.parse({
    period,
    startDate: custom?.startDate,
    endDate: custom?.endDate,
  });
  const range = getDateRange(period, custom);
  const previousRange = getPreviousDateRange(range);

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

  // 4. Debt balance-log payments as expenses
  const debtPayments = await db
    .select({
      paymentMade: debtBalanceLogs.paymentMade,
      loggedAt: debtBalanceLogs.loggedAt,
      debtName: debtsCredits.name,
    })
    .from(debtBalanceLogs)
    .innerJoin(debtsCredits, eq(debtBalanceLogs.debtId, debtsCredits.id))
    .where(
      and(
        eq(debtBalanceLogs.userId, userId),
        eq(debtsCredits.workspaceId, workspaceId),
        gte(debtBalanceLogs.loggedAt, range.startDate),
        lte(debtBalanceLogs.loggedAt, range.endDate),
        sql`${debtBalanceLogs.paymentMade} IS NOT NULL AND ${debtBalanceLogs.paymentMade} > 0`,
      ),
    );

  let debtPaymentsTotal = 0;
  for (const row of debtPayments) {
    if (row.paymentMade) {
      debtPaymentsTotal += Number(row.paymentMade);
    }
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
  for (const row of debtPayments) {
    if (row.paymentMade) {
      const date = row.loggedAt;
      let entry = dailyMap.get(date);
      if (!entry) {
        entry = { date, expenses: 0, givings: 0, income: 0 };
        dailyMap.set(date, entry);
      }
      entry.expenses += Number(row.paymentMade);
    }
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

  return {
    totalExpenses,
    totalGivings,
    totalIncome,
    netBalance,
    safeToSpend: totalIncome - totalExpenses - totalGivings,
    transactionCount,
    expensesByCategoryArray,
    givingsByCategoryArray,
    incomeByCategoryArray,
    dailyTrends,
    monthlyTrends,
    period: range,
    previousPeriod: previousRange,
    comparisons: {
      expensesChange: getPercentChange(totalExpenses, previousTotals.totalExpenses),
      givingsChange: getPercentChange(totalGivings, previousTotals.totalGivings),
      incomeChange: getPercentChange(totalIncome, previousTotals.totalIncome),
      netBalanceChange: getPercentChange(netBalance, previousNetBalance),
      transactionCountChange: getPercentChange(transactionCount, previousTotals.transactionCount),
    },
    outgoingPaymentsTotal,
    debtPaymentsTotal,
  };
}
