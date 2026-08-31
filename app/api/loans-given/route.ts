import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as loansService from "@/lib/db/loans-given";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { toLoan } from "./serialize";

export async function GET() {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const loans = await loansService.list(workspaceId);
    const summary = await loansService.getSummary(workspaceId);

    return NextResponse.json({
      loans: loans.map(toLoan),
      total_lent: summary.totalLent,
      total_outstanding: summary.totalOutstanding,
      active_count: summary.count,
      // Interest owed across every unsettled loan — the receivable the
      // principal-only `total_outstanding` deliberately excludes.
      total_interest_outstanding:
        Math.round(
          loans.reduce((sum, loan) => sum + loan.interest.interestOutstanding, 0) * 100,
        ) / 100,
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
    const { workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const row = await loansService.create(workspaceId, {
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
