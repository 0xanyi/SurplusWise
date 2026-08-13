import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as draftsService from "@/lib/db/recurring-money-drafts";
import { getPeriodMonthFromDate, getCurrentUtcDate } from "@/lib/outgoings-date";

function currentPeriodMonth() {
  return getPeriodMonthFromDate(getCurrentUtcDate());
}

function toDraft(row: Awaited<ReturnType<typeof draftsService.list>>[number]) {
  return {
    id: row.id,
    recurring_money_id: row.recurringMoneyId,
    recurring_money_name: row.recurringMoneyName,
    period_month: row.periodMonth,
    due_date: row.dueDate,
    expected_amount: Number(row.expectedAmount),
    type: row.type,
    category: row.category,
    payee: row.payee,
    client_id: row.clientId,
    giving_recipient_id: row.givingRecipientId,
    giving_designation_id: row.givingDesignationId,
    status: row.transactionId ? "matched" : "draft",
    transaction: row.transactionId
      ? {
          id: row.transactionId,
          amount: Number(row.matchedAmount),
          date: row.matchedDate,
          payee: row.matchedPayee,
        }
      : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const periodMonth = request.nextUrl.searchParams.get("periodMonth") ?? currentPeriodMonth();
    const rows = await draftsService.list(userId, workspaceId, periodMonth);
    return NextResponse.json({
      period_month: periodMonth,
      drafts: rows.map(toDraft),
      matched: rows.filter((row) => row.transactionId).length,
      outstanding: rows.filter((row) => !row.transactionId).length,
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch recurring money drafts");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const periodMonth = body.periodMonth ?? body.period_month ?? currentPeriodMonth();
    const created = await draftsService.generate(userId, workspaceId, periodMonth);
    const rows = await draftsService.list(userId, workspaceId, periodMonth);
    return NextResponse.json(
      {
        period_month: periodMonth,
        created: created.length,
        drafts: rows.map(toDraft),
      },
      { status: created.length > 0 ? 201 : 200 },
    );
  } catch (error) {
    return errorResponse(error, "Failed to generate recurring money drafts");
  }
}
