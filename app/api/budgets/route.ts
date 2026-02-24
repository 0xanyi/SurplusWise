import { requireAuth } from "@/lib/auth-server";
import * as budgetsService from "@/lib/db/budgets";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function getBudgetStatus(percentage: number) {
  if (percentage >= 100) return "exceeded";
  if (percentage >= 80) return "warning";
  return "ok";
}

/** Map DB row (enriched with spending) → API response shape. */
function toBudget(budget: Record<string, unknown>) {
  const percentUsed =
    typeof budget.percentUsed === "number" ? budget.percentUsed : 0;
  const amount = Number(budget.amount);
  const spent = typeof budget.spent === "number" ? budget.spent : 0;
  const remaining =
    typeof budget.remaining === "number" ? budget.remaining : amount;

  return {
    id: budget.id,
    category: budget.category,
    amount,
    period: budget.period,
    start_date: budget.startDate,
    end_date: budget.endDate,
    type: budget.type,
    is_active: budget.isActive,
    spent,
    remaining,
    percentage: percentUsed,
    status: getBudgetStatus(percentUsed),
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const period = request.nextUrl.searchParams.get("period") as
      | "monthly"
      | "quarterly"
      | "yearly"
      | null;

    const budgets = await budgetsService.getWithSpending(
      userId,
      period ?? undefined,
    );

    return NextResponse.json({ budgets: budgets.map(toBudget) });
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
    console.error("Failed to fetch budgets:", error);
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const startDate = body.startDate ?? body.start_date;
    const endDate = body.endDate ?? body.end_date;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    const row = await budgetsService.create(userId, {
      category: body.category,
      amount: body.amount,
      period: body.period,
      startDate,
      endDate,
      type: body.type,
    });

    return NextResponse.json({ id: row.id });
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
    console.error("Failed to create budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 },
    );
  }
}
