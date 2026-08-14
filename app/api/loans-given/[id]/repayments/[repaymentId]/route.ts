import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as loansService from "@/lib/db/loans-given";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; repaymentId: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id, repaymentId } = await params;

    await loansService.removeRepayment(userId, id, repaymentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to delete repayment:", error);
    return NextResponse.json(
      { error: "Failed to delete repayment" },
      { status: 500 },
    );
  }
}
