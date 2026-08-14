import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as goalsService from "@/lib/db/goals";
import * as goalActivitiesService from "@/lib/db/goal-activities";
import { getGoalFundingPlan } from "@/lib/goal-planning";

function toGoal(
  row: Awaited<ReturnType<typeof goalsService.list>>[number],
  spentAmount: number,
  today: string,
) {
  const targetAmount = Number(row.targetAmount);
  const currentAmount = Number(row.currentAmount);
  const fundedAmount = currentAmount + spentAmount;
  const remainingAmount = Math.max(targetAmount - fundedAmount, 0);
  const progress = targetAmount > 0 ? (fundedAmount / targetAmount) * 100 : 0;
  const fundingPlan = getGoalFundingPlan(
    targetAmount,
    fundedAmount,
    row.targetDate,
    today,
  );

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    target_amount: targetAmount,
    current_amount: currentAmount,
    available_amount: currentAmount,
    funded_amount: fundedAmount,
    spent_amount: spentAmount,
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
    const [rows, spentByGoal] = await Promise.all([
      goalsService.list(userId, workspaceId),
      goalActivitiesService.getSpentByGoal(userId, workspaceId),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const apiGoals = rows.map((row) => toGoal(row, spentByGoal.get(row.id) ?? 0, today));
    const activeGoals = apiGoals.filter((goal) => goal.is_active);
    const totalTarget = activeGoals.reduce((sum, goal) => sum + goal.target_amount, 0);
    const totalCurrent = activeGoals.reduce((sum, goal) => sum + goal.available_amount, 0);
    const totalFunded = activeGoals.reduce((sum, goal) => sum + goal.funded_amount, 0);

    return NextResponse.json({
      goals: apiGoals,
      total_target: totalTarget,
      total_current: totalCurrent,
      total_funded: totalFunded,
      active_count: activeGoals.length,
      completion_rate: totalTarget > 0 ? (totalFunded / totalTarget) * 100 : 0,
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
