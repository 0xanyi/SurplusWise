import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import { getCurrentUtcDate } from "@/lib/outgoings-date";
import * as recurringMoneyOccurrences from "@/lib/recurring-money-occurrences";
import { toOccurrence } from "../../serialize";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await recurringMoneyOccurrences.settle(workspaceId, {
      action: "mark-paid",
      occurrenceId: id,
      paidAt: body.paidAt ?? body.paid_at ?? getCurrentUtcDate(),
    });
    return NextResponse.json(
      {
        transaction_id: result.transactionId,
        occurrence: toOccurrence(result.occurrence),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof recurringMoneyOccurrences.RecurringMoneySettlementError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Failed to settle Recurring money occurrence");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const transactionId = request.nextUrl.searchParams.get("transactionId") ?? "";
    const result = await recurringMoneyOccurrences.settle(workspaceId, {
      action: "unmatch",
      occurrenceId: id,
      transactionId,
    });
    return NextResponse.json({ occurrence: toOccurrence(result.occurrence) });
  } catch (error) {
    if (error instanceof recurringMoneyOccurrences.RecurringMoneySettlementError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Failed to reverse Recurring money settlement");
  }
}
