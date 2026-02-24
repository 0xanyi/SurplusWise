import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import {
  userIdSchema,
  analyticsQuerySchema,
} from "./validation";
import { getDateRange } from "./helpers";
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
  transactionCount: number;
  expensesByCategoryArray: CategoryAggregate[];
  givingsByCategoryArray: CategoryAggregate[];
  incomeByCategoryArray: CategoryAggregate[];
  dailyTrends: DailyTrend[];
  monthlyTrends: MonthlyTrend[];
  period: DateRange;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Full analytics payload that mirrors the existing `/api/analytics` response.
 * All aggregation is done in SQL where possible.
 */
export async function getAnalytics(
  userId: string,
  period: Period,
  custom?: Partial<DateRange>,
): Promise<AnalyticsResult> {
  userIdSchema.parse(userId);
  analyticsQuerySchema.parse({
    period,
    startDate: custom?.startDate,
    endDate: custom?.endDate,
  });
  const range = getDateRange(period, custom);

  const where = and(
    eq(transactions.userId, userId),
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

  // Sort each descending by value
  expensesByCategoryArray.sort((a, b) => b.value - a.value);
  givingsByCategoryArray.sort((a, b) => b.value - a.value);
  incomeByCategoryArray.sort((a, b) => b.value - a.value);

  // 3. Daily trends (single query)
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
  const dailyTrends = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // 4. Monthly trends (derived from daily for consistency)
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

  return {
    totalExpenses,
    totalGivings,
    totalIncome,
    transactionCount,
    expensesByCategoryArray,
    givingsByCategoryArray,
    incomeByCategoryArray,
    dailyTrends,
    monthlyTrends,
    period: range,
  };
}
