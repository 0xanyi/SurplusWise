import { NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as profileService from "@/lib/db/transaction-import-profiles";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    await profileService.remove(workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete import profile";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
