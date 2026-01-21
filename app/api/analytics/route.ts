import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  let startDate: string;

  switch (period) {
    case "week":
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split("T")[0];
      break;
    case "month":
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = monthAgo.toISOString().split("T")[0];
      break;
    case "quarter":
      const quarterAgo = new Date(now);
      quarterAgo.setMonth(quarterAgo.getMonth() - 3);
      startDate = quarterAgo.toISOString().split("T")[0];
      break;
    case "year":
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

    const user = await fetchAuthQuery(api.auth.getCurrentUser, {});
    if (!user) {
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
    let totalExpenses = 0;
    let totalGivings = 0;

    for (const t of transactions) {
      if (t.type === "expense") {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        totalExpenses += t.amount;
      } else {
        givingsByCategory[t.category] = (givingsByCategory[t.category] || 0) + t.amount;
        totalGivings += t.amount;
      }
    }

    const expensesByCategoryArray = Object.entries(expensesByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const givingsByCategoryArray = Object.entries(givingsByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const dailyTotals: Record<string, { expenses: number; givings: number }> = {};
    for (const t of transactions) {
      if (!dailyTotals[t.date]) {
        dailyTotals[t.date] = { expenses: 0, givings: 0 };
      }
      if (t.type === "expense") {
        dailyTotals[t.date].expenses += t.amount;
      } else {
        dailyTotals[t.date].givings += t.amount;
      }
    }

    const trendData = Object.entries(dailyTotals)
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalExpenses,
      totalGivings,
      netBalance: totalGivings - totalExpenses,
      expensesByCategory,
      givingsByCategory,
      expensesByCategoryArray,
      givingsByCategoryArray,
      trendData,
      transactionCount: transactions.length,
      period: { startDate, endDate },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
