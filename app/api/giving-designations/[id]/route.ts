import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as givingService from "@/lib/db/giving-recipients";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    await givingService.updateDesignation(userId, workspaceId, id, await request.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(
      error,
      "Failed to update giving designation",
      "That designation already exists for this recipient",
    );
  }
}
