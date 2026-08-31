import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";
import * as recurringMoneyService from "@/lib/db/recurring-outgoings";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const paidAt = body.paidAt ?? body.paid_at ?? getCurrentUtcDate();
    const result = await recurringMoneyService.settle(workspaceId, id, {
      paidAt,
      amount: body.amount,
      periodMonth: body.periodMonth ?? body.period_month,
    });
    return NextResponse.json(
      { id: result.transaction.id, draft_id: result.draftId },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof recurringMoneyService.RecurringMoneySettlementError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Failed to settle Recurring money");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const periodMonth =
      request.nextUrl.searchParams.get("periodMonth") ??
      getPeriodMonthFromDate(getCurrentUtcDate());
    await recurringMoneyService.unsettle(workspaceId, id, periodMonth);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof recurringMoneyService.RecurringMoneySettlementError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Failed to unsettle Recurring money");
  }
}
