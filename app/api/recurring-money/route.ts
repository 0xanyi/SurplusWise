import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as recurringMoneyService from "@/lib/db/recurring-outgoings";

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

export async function GET() {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const rows = await recurringMoneyService.list(workspaceId);
    const active = rows.filter((row) => row.isActive);
    return NextResponse.json({
      items: rows.map(toRecurringMoney),
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
