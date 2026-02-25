import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as debtsService from "@/lib/db/debts-credits";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toDebt(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    debt_type: row.debtType,
    lender: row.lender,
    current_balance: Number(row.currentBalance),
    credit_limit: row.creditLimit != null ? Number(row.creditLimit) : null,
    interest_rate: row.interestRate != null ? Number(row.interestRate) : null,
    minimum_payment: row.minimumPayment != null ? Number(row.minimumPayment) : null,
    payment_day_of_month: row.paymentDayOfMonth,
    start_date: row.startDate,
    end_date: row.endDate,
    notes: row.notes,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const debts = await debtsService.list(userId, workspaceId);
    const summary = await debtsService.getSummary(userId, workspaceId);

    return NextResponse.json({
      debts: debts.map(toDebt),
      total_balance: summary.totalBalance,
      total_min_payment: summary.totalMinPayment,
      active_count: summary.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch debts/credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch debts/credits" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const row = await debtsService.create(userId, workspaceId, {
      name: body.name,
      debtType: body.debtType ?? body.debt_type,
      lender: body.lender,
      currentBalance: body.currentBalance ?? body.current_balance,
      creditLimit: body.creditLimit ?? body.credit_limit,
      interestRate: body.interestRate ?? body.interest_rate,
      minimumPayment: body.minimumPayment ?? body.minimum_payment,
      paymentDayOfMonth: body.paymentDayOfMonth ?? body.payment_day_of_month,
      startDate: body.startDate ?? body.start_date,
      endDate: body.endDate ?? body.end_date,
      notes: body.notes,
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
    console.error("Failed to create debt/credit:", error);
    return NextResponse.json(
      { error: "Failed to create debt/credit" },
      { status: 500 },
    );
  }
}
