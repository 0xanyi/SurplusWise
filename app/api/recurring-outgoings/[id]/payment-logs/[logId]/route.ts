import { requireAuth } from "@/lib/auth-server";
import * as paymentLogService from "@/lib/db/outgoing-payment-logs";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id: outgoingId, logId } = await params;

    await paymentLogService.remove(userId, outgoingId, logId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to delete payment log:", error);
    return NextResponse.json(
      { error: "Failed to delete payment log" },
      { status: 500 },
    );
  }
}
