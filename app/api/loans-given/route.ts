import { requireAuth } from "@/lib/auth-server";
import * as loansService from "@/lib/db/loans-given";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toLoan(row: Record<string, unknown>) {
  return {
    id: row.id,
    borrower_name: row.borrowerName,
    amount: Number(row.amount),
    outstanding_balance: Number(row.outstandingBalance),
    loan_date: row.loanDate,
    expected_payback_date: row.expectedPaybackDate,
    status: row.status,
    interest_rate: row.interestRate != null ? Number(row.interestRate) : null,
    notes: row.notes,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function GET() {
  try {
    const userId = await requireAuth();
    const loans = await loansService.list(userId);
    const summary = await loansService.getSummary(userId);

    return NextResponse.json({
      loans: loans.map(toLoan),
      total_lent: summary.totalLent,
      total_outstanding: summary.totalOutstanding,
      active_count: summary.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch loans given:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans given" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const row = await loansService.create(userId, {
      borrowerName: body.borrowerName ?? body.borrower_name,
      amount: body.amount,
      loanDate: body.loanDate ?? body.loan_date,
      expectedPaybackDate: body.expectedPaybackDate ?? body.expected_payback_date,
      interestRate: body.interestRate ?? body.interest_rate,
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
    console.error("Failed to create loan given:", error);
    return NextResponse.json(
      { error: "Failed to create loan given" },
      { status: 500 },
    );
  }
}
