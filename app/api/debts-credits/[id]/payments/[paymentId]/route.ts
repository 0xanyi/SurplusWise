import { requireAuth } from "@/lib/auth-server";
import * as statementsService from "@/lib/db/debt-statements";
import { errorResponse } from "@/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id, paymentId } = await params;

    await statementsService.removePayment(userId, id, paymentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete payment");
  }
}
