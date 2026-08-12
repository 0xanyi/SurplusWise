import { NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as accountService from "@/lib/db/financial-accounts";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    await accountService.removeTransfer(userId, workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete transfer";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
