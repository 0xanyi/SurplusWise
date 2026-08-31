import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as givingService from "@/lib/db/giving-recipients";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await givingService.createDesignation(workspaceId, {
      recipientId: body.recipientId ?? body.recipient_id,
      name: body.name,
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    return errorResponse(
      error,
      "Failed to create giving designation",
      "That designation already exists for this recipient",
    );
  }
}
