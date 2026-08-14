import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as goalsService from "@/lib/db/goals";
import { getGoalFundingPlan } from "@/lib/goal-planning";

function toGoal(row: Awaited<ReturnType<typeof goalsService.list>>[number], today: string) {
  const targetAmount = Number(row.targetAmount);
  const currentAmount = Number(row.currentAmount);
  const remainingAmount = Math.max(targetAmount - currentAmount, 0);
  const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
  const fundingPlan = getGoalFundingPlan(
    targetAmount,
    currentAmount,
    row.targetDate,
    today,
  );

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    target_amount: targetAmount,
    current_amount: currentAmount,
    remaining_amount: remainingAmount,
    progress,
    target_date: row.targetDate,
    funding_status: fundingPlan.fundingStatus,
    months_remaining: fundingPlan.monthsRemaining,
    monthly_contribution: fundingPlan.monthlyContribution,
    notes: row.notes,
    is_active: row.isActive,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const rows = await goalsService.list(userId, workspaceId);
    const summary = await goalsService.getSummary(userId, workspaceId);
    const today = new Date().toISOString().slice(0, 10);

    return NextResponse.json({
      goals: rows.map((row) => toGoal(row, today)),
      total_target: summary.totalTarget,
      total_current: summary.totalCurrent,
      active_count: summary.count,
      completion_rate: summary.completionRate,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const row = await goalsService.create(userId, workspaceId, {
      name: body.name,
      category: body.category,
      targetAmount: body.targetAmount ?? body.target_amount,
      currentAmount: body.currentAmount ?? body.current_amount,
      targetDate: body.targetDate ?? body.target_date,
      notes: body.notes,
    });

    return NextResponse.json({ id: row.id }, { status: 201 });
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
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
