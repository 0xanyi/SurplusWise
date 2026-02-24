import { requireAuth } from "@/lib/auth-server";
import * as loansService from "@/lib/db/loans-given";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toRepayment(row: Record<string, unknown>) {
  return {
    id: row.id,
    loan_id: row.loanId,
    amount: Number(row.amount),
    repayment_date: row.repaymentDate,
    notes: row.notes,
    created_at: row.createdAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;

    const repayments = await loansService.listRepayments(userId, id);

    return NextResponse.json({ repayments: repayments.map(toRepayment) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to fetch repayments:", error);
    return NextResponse.json(
      { error: "Failed to fetch repayments" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const repayment = await loansService.addRepayment(userId, id, {
      amount: body.amount,
      repaymentDate: body.repaymentDate ?? body.repayment_date,
      notes: body.notes,
    });

    return NextResponse.json({ id: repayment.id });
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
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to create repayment:", error);
    return NextResponse.json(
      { error: "Failed to create repayment" },
      { status: 500 },
    );
  }
}
