import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as debtsService from "@/lib/db/debts-credits";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id, logId } = await params;

    await debtsService.removeBalanceLog(workspaceId, id, logId);

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
    if (
      error instanceof Error &&
      error.message.includes("Cannot delete the only balance log")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to delete balance log:", error);
    return NextResponse.json(
      { error: "Failed to delete balance log" },
      { status: 500 },
    );
  }
}
