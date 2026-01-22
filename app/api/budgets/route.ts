import { isAuthenticated, fetchAuthQuery, fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";

const getBudgetStatus = (percentage: number) => {
  if (percentage >= 100) return "exceeded";
  if (percentage >= 80) return "warning";
  return "ok";
};

const toBudget = (budget: any) => {
  const percentage =
    typeof budget.percentUsed === "number"
      ? budget.percentUsed
      : budget.amount > 0
      ? (budget.spent / budget.amount) * 100
      : 0;

  return {
    id: budget._id,
    category: budget.category,
    amount: budget.amount,
    period: budget.period,
    start_date: budget.startDate,
    end_date: budget.endDate,
    type: budget.type,
    is_active: budget.isActive,
    spent: budget.spent ?? 0,
    remaining: budget.remaining ?? budget.amount,
    percentage,
    status: getBudgetStatus(percentage),
  };
};

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const period = request.nextUrl.searchParams.get("period") as
      | "monthly"
      | "quarterly"
      | "yearly"
      | null;
    const budgets = await fetchAuthQuery(api.budgets.getWithSpending, {
      period: period ?? undefined,
    });

    return NextResponse.json({ budgets: budgets.map(toBudget) });
  } catch (error) {
    console.error("Failed to fetch budgets:", error);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const startDate = body.startDate ?? body.start_date;
    const endDate = body.endDate ?? body.end_date;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const id = await fetchAuthMutation(api.budgets.create, {
      category: body.category,
      amount: body.amount,
      period: body.period,
      startDate,
      endDate,
      type: body.type,
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Failed to create budget:", error);
    return NextResponse.json({ error: "Failed to create budget" }, { status: 500 });
  }
}
