import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as loansService from "@/lib/db/loans-given";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { toLoan, toSchedule } from "../serialize";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;

    const loan = await loansService.getById(userId, id);
    const repayments = await loansService.listRepayments(userId, id);

    return NextResponse.json({
      ...toLoan(loan),
      interest_schedule: toSchedule(loan.interest.months),
      repayments: repayments.map((row) => ({
        id: row.id,
        loan_id: row.loanId,
        amount: Number(row.amount),
        repayment_date: row.repaymentDate,
        notes: row.notes,
        created_at: row.createdAt?.toISOString() ?? null,
      })),
    });
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
    console.error("Failed to fetch loan given:", error);
    return NextResponse.json({ error: "Failed to fetch loan given" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    const input: loansService.UpdateInput = {
      ...((body.borrowerName ?? body.borrower_name) !== undefined && {
        borrowerName: body.borrowerName ?? body.borrower_name,
      }),
      ...(body.amount !== undefined && { amount: body.amount }),
      // `outstanding_balance` is no longer accepted: it is derived from the
      // repayment ledger, and a hand-set value would make the interest figures
      // computed against it wrong.
      ...((body.loanDate ?? body.loan_date) !== undefined && {
        loanDate: body.loanDate ?? body.loan_date,
      }),
      ...((body.expectedPaybackDate ?? body.expected_payback_date) !== undefined && {
        expectedPaybackDate: body.expectedPaybackDate ?? body.expected_payback_date,
      }),
      ...(body.status !== undefined && { status: body.status }),
      ...((body.interestRate ?? body.interest_rate) !== undefined && {
        interestRate: body.interestRate ?? body.interest_rate,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
    };

    await loansService.update(userId, id, input);

    return NextResponse.json({ success: true });
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
    console.error("Failed to update loan given:", error);
    return NextResponse.json(
      { error: "Failed to update loan given" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id } = await params;

    await loansService.remove(userId, id);

    return NextResponse.json({ success: true });
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
    console.error("Failed to delete loan given:", error);
    return NextResponse.json(
      { error: "Failed to delete loan given" },
      { status: 500 },
    );
  }
}
