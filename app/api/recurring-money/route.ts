import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";
import * as recurringMoneyService from "@/lib/db/recurring-outgoings";
import * as recurringMoneyOccurrences from "@/lib/recurring-money-occurrences";

function toRecurringMoney(row: Awaited<ReturnType<typeof recurringMoneyService.list>>[number]) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    type: row.type,
    day_of_month: row.dayOfMonth,
    frequency: row.frequency,
    category: row.category,
    payee: row.vendor,
    client_id: row.clientId,
    client_name: row.clientName,
    giving_recipient_id: row.givingRecipientId,
    giving_recipient_name: row.givingRecipientName,
    giving_designation_id: row.givingDesignationId,
    giving_designation_name: row.givingDesignationName,
    rebill_mode: row.rebillMode,
    rebill_amount: row.rebillAmount === null ? null : Number(row.rebillAmount),
    notes: row.notes,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const typeParam = request.nextUrl.searchParams.get("type");
    const type =
      typeParam === "income" || typeParam === "expense" || typeParam === "giving"
        ? typeParam
        : undefined;
    const periodMonth =
      request.nextUrl.searchParams.get("periodMonth") ??
      getPeriodMonthFromDate(getCurrentUtcDate());
    const rows = await recurringMoneyService.list(workspaceId, undefined, type);
    const { occurrences } = await recurringMoneyOccurrences.month(workspaceId, periodMonth);
    const occurrenceById = new Map(
      occurrences.map((occurrence) => [occurrence.recurringMoneyId, occurrence]),
    );
    const items = rows.map((row) => {
      const occurrence = occurrenceById.get(row.id);
      const mapped = toRecurringMoney(row);
      return {
        ...mapped,
        occurrence: occurrence
          ? {
              id: occurrence.id,
              state: occurrence.state,
              status: occurrence.status,
              recorded_amount: occurrence.recordedAmount,
              outstanding_amount: occurrence.outstandingAmount,
              overpaid_amount: occurrence.overpaidAmount,
              settlements: occurrence.settlements.map((settlement) => ({
                transaction_id: settlement.transactionId,
                provenance: settlement.provenance,
              })),
            }
          : null,
      };
    });
    const active = rows.filter((row) => row.isActive);
    const summary = type === "expense"
      ? await recurringMoneyService.getMonthlyTotal(workspaceId)
      : null;
    return NextResponse.json({
      items,
      period_month: periodMonth,
      monthly_totals: {
        income: active
          .filter((row) => row.type === "income")
          .reduce((sum, row) => sum + Number(row.amount), 0),
        expense: active
          .filter((row) => row.type === "expense")
          .reduce((sum, row) => sum + Number(row.amount), 0),
        giving: active
          .filter((row) => row.type === "giving")
          .reduce((sum, row) => sum + Number(row.amount), 0),
      },
      ...(summary && {
        monthly_total: summary.total,
        monthly_overhead: summary.overhead,
        monthly_pass_through: summary.passThrough,
        active_count: summary.count,
      }),
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch recurring money");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await recurringMoneyService.create(workspaceId, {
      name: body.name,
      amount: body.amount,
      type: body.type,
      dayOfMonth: Object.hasOwn(body, "dayOfMonth") ? body.dayOfMonth : body.day_of_month,
      frequency: body.frequency,
      category: body.category,
      vendor: Object.hasOwn(body, "payee") ? body.payee : body.vendor,
      clientId: Object.hasOwn(body, "clientId") ? body.clientId : body.client_id,
      givingRecipientId: Object.hasOwn(body, "givingRecipientId")
        ? body.givingRecipientId
        : body.giving_recipient_id,
      givingDesignationId: Object.hasOwn(body, "givingDesignationId")
        ? body.givingDesignationId
        : body.giving_designation_id,
      rebillMode: Object.hasOwn(body, "rebillMode") ? body.rebillMode : body.rebill_mode,
      rebillAmount: Object.hasOwn(body, "rebillAmount")
        ? body.rebillAmount
        : body.rebill_amount,
      notes: body.notes,
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    if (error instanceof recurringMoneyService.RecurringMoneyShapeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to create recurring money");
  }
}
