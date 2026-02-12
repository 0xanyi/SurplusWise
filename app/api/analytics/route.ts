import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  let startDate: string;

  switch (period) {
    case "week":
    case "weekly":
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split("T")[0];
      break;
    case "month":
    case "monthly":
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = monthAgo.toISOString().split("T")[0];
      break;
    case "quarter":
    case "quarterly":
      const quarterAgo = new Date(now);
      quarterAgo.setMonth(quarterAgo.getMonth() - 3);
      startDate = quarterAgo.toISOString().split("T")[0];
      break;
    case "year":
    case "yearly":
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      startDate = yearAgo.toISOString().split("T")[0];
      break;
    default:
      const defaultStart = new Date(now);
      defaultStart.setMonth(defaultStart.getMonth() - 1);
      startDate = defaultStart.toISOString().split("T")[0];
  }

  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "month";
    let startDate = searchParams.get("startDate");
    let endDate = searchParams.get("endDate");

    if (period !== "custom" || !startDate || !endDate) {
      const range = getDateRange(period);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    const transactions = await fetchAuthQuery(api.transactions.list, {
      startDate,
      endDate,
    });

    const expensesByCategory: Record<string, number> = {};
    const givingsByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    let totalGivings = 0;
    let totalIncome = 0;

    for (const t of transactions) {
      if (t.type === "expense") {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        totalExpenses += t.amount;
      } else if (t.type === "giving") {
        givingsByCategory[t.category] = (givingsByCategory[t.category] || 0) + t.amount;
        totalGivings += t.amount;
      } else if (t.type === "income") {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
        totalIncome += t.amount;
      }
    }

    const expensesByCategoryArray = Object.entries(expensesByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const givingsByCategoryArray = Object.entries(givingsByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const incomeByCategoryArray = Object.entries(incomeByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const dailyTotals: Record<string, { expenses: number; givings: number; income: number }> = {};
    for (const t of transactions) {
      if (!dailyTotals[t.date]) {
        dailyTotals[t.date] = { expenses: 0, givings: 0, income: 0 };
      }
      if (t.type === "expense") {
        dailyTotals[t.date].expenses += t.amount;
      } else if (t.type === "giving") {
        dailyTotals[t.date].givings += t.amount;
      } else if (t.type === "income") {
        dailyTotals[t.date].income += t.amount;
      }
    }

    const trendData = Object.entries(dailyTotals)
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const monthlyTotals: Record<string, { expenses: number; givings: number; income: number }> = {};
    for (const entry of trendData) {
      const monthKey = entry.date.slice(0, 7);
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { expenses: 0, givings: 0, income: 0 };
      }
      monthlyTotals[monthKey].expenses += entry.expenses;
      monthlyTotals[monthKey].givings += entry.givings;
      monthlyTotals[monthKey].income += entry.income;
    }

    const monthlyTrends = Object.entries(monthlyTotals)
      .map(([month, totals]) => ({ month, ...totals }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      totalExpenses,
      totalGivings,
      totalIncome,
      netBalance: totalIncome - totalExpenses - totalGivings,
      expensesByCategory,
      givingsByCategory,
      incomeByCategory,
      expensesByCategoryArray,
      givingsByCategoryArray,
      incomeByCategoryArray,
      dailyTrends: trendData,
      monthlyTrends,
      transactionCount: transactions.length,
      period: { startDate, endDate },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
