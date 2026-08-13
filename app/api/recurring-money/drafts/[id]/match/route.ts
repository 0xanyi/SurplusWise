import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as draftsService from "@/lib/db/recurring-money-drafts";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    await draftsService.unmatch(userId, workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to unmatch recurring money draft");
  }
}
