import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as recurringMoneyService from "@/lib/db/recurring-outgoings";
import { RecurringMoneyConstraintError } from "@/lib/recurring-money-occurrences";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const dayOfMonth = Object.hasOwn(body, "dayOfMonth")
      ? body.dayOfMonth
      : body.day_of_month;
    const rebillMode = Object.hasOwn(body, "rebillMode")
      ? body.rebillMode
      : body.rebill_mode;
    const isActive = Object.hasOwn(body, "isActive") ? body.isActive : body.is_active;
    const input: recurringMoneyService.UpdateInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.type !== undefined && { type: body.type }),
      ...(dayOfMonth !== undefined && { dayOfMonth }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(body.category !== undefined && { category: body.category }),
      ...((Object.hasOwn(body, "payee") || Object.hasOwn(body, "vendor")) && {
        vendor: Object.hasOwn(body, "payee") ? body.payee : body.vendor,
      }),
      ...((Object.hasOwn(body, "clientId") || Object.hasOwn(body, "client_id")) && {
        clientId: Object.hasOwn(body, "clientId") ? body.clientId : body.client_id,
      }),
      ...((Object.hasOwn(body, "givingRecipientId") ||
        Object.hasOwn(body, "giving_recipient_id")) && {
        givingRecipientId: Object.hasOwn(body, "givingRecipientId")
          ? body.givingRecipientId
          : body.giving_recipient_id,
      }),
      ...((Object.hasOwn(body, "givingDesignationId") ||
        Object.hasOwn(body, "giving_designation_id")) && {
        givingDesignationId: Object.hasOwn(body, "givingDesignationId")
          ? body.givingDesignationId
          : body.giving_designation_id,
      }),
      ...(rebillMode !== undefined && { rebillMode }),
      ...((Object.hasOwn(body, "rebillAmount") ||
        Object.hasOwn(body, "rebill_amount")) && {
        rebillAmount: Object.hasOwn(body, "rebillAmount")
          ? body.rebillAmount
          : body.rebill_amount,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(isActive !== undefined && { isActive }),
    };
    const row = await recurringMoneyService.update(workspaceId, id, input);
    return NextResponse.json({ id: row.id });
  } catch (error) {
    if (error instanceof recurringMoneyService.RecurringMoneyShapeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to update recurring money");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    await recurringMoneyService.remove(workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RecurringMoneyConstraintError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Failed to delete recurring money");
  }
}
