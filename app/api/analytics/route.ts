import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { getAnalytics } from "@/lib/db/analytics";
import type { ComparisonMode, Period } from "@/lib/db/helpers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");

    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "month") as Period;
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;
    const comparison = (searchParams.get("comparison") ||
      "previous-period") as ComparisonMode;

    const result = await getAnalytics(
      userId,
      workspaceId,
      period,
      startDate || endDate ? { startDate, endDate } : undefined,
      comparison,
    );

    // Build the object-keyed maps the frontend also consumes (backward compat)
    const expensesByCategory: Record<string, number> = {};
    for (const c of result.expensesByCategoryArray) {
      expensesByCategory[c.name] = c.value;
    }
    const givingsByCategory: Record<string, number> = {};
    for (const c of result.givingsByCategoryArray) {
      givingsByCategory[c.name] = c.value;
    }
    const incomeByCategory: Record<string, number> = {};
    for (const c of result.incomeByCategoryArray) {
      incomeByCategory[c.name] = c.value;
    }

    return NextResponse.json({
      totalExpenses: result.totalExpenses,
      totalGivings: result.totalGivings,
      totalIncome: result.totalIncome,
      safeToSpend: result.safeToSpend,
      safeToSpendBreakdown: result.safeToSpendBreakdown,
      spendingPrediction: result.spendingPrediction,
      netBalance: result.netBalance,
      expensesByCategory,
      givingsByCategory,
      incomeByCategory,
      expensesByCategoryArray: result.expensesByCategoryArray,
      givingsByCategoryArray: result.givingsByCategoryArray,
      incomeByCategoryArray: result.incomeByCategoryArray,
      dailyTrends: result.dailyTrends,
      monthlyTrends: result.monthlyTrends,
      transactionCount: result.transactionCount,
      period: result.period,
      previousPeriod: result.previousPeriod,
      comparisonMode: result.comparisonMode,
      comparisons: result.comparisons,
      outgoingPaymentsTotal: result.outgoingPaymentsTotal,
      debtPaymentsTotal: result.debtPaymentsTotal,
      costOfBorrowing: result.costOfBorrowing,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
