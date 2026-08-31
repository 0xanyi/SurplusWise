import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as draftsService from "@/lib/db/recurring-money-drafts";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const expectedAmount = Object.hasOwn(body, "expectedAmount")
      ? body.expectedAmount
      : body.expected_amount;
    const row = await draftsService.updateExpectedAmount(
      workspaceId,
      id,
      expectedAmount,
    );
    return NextResponse.json({ id: row.id, expected_amount: Number(row.expectedAmount) });
  } catch (error) {
    return errorResponse(error, "Failed to update recurring money draft");
  }
}
