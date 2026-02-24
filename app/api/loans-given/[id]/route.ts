import { requireAuth } from "@/lib/auth-server";
import * as loansService from "@/lib/db/loans-given";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const input: loansService.UpdateInput = {
      ...((body.borrowerName ?? body.borrower_name) !== undefined && {
        borrowerName: body.borrowerName ?? body.borrower_name,
      }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...((body.outstandingBalance ?? body.outstanding_balance) !== undefined && {
        outstandingBalance: body.outstandingBalance ?? body.outstanding_balance,
      }),
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
    const userId = await requireAuth();
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
