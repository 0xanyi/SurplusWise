import { requireAuth } from "@/lib/auth-server";
import * as outgoingsService from "@/lib/db/recurring-outgoings";
import { errorResponse } from "@/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const input: outgoingsService.UpdateInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...((body.dayOfMonth ?? body.day_of_month) !== undefined && {
        dayOfMonth: body.dayOfMonth ?? body.day_of_month,
      }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.vendor !== undefined && { vendor: body.vendor }),
      // Read with `in` rather than `??` so an explicit null still detaches the
      // client; `??` would treat clearing the field as not mentioning it.
      ...("clientId" in body && { clientId: body.clientId }),
      ...("client_id" in body && { clientId: body.client_id }),
      ...((body.rebillMode ?? body.rebill_mode) !== undefined && {
        rebillMode: body.rebillMode ?? body.rebill_mode,
      }),
      ...("rebillAmount" in body && { rebillAmount: body.rebillAmount }),
      ...("rebill_amount" in body && { rebillAmount: body.rebill_amount }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    };

    await outgoingsService.update(userId, id, input);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to update recurring outgoing");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;

    await outgoingsService.remove(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete recurring outgoing");
  }
}
