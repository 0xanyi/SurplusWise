import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as commitmentsService from "@/lib/db/giving-commitments";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const designationId =
      body.designationId !== undefined ? body.designationId : body.designation_id;
    const startDate = body.startDate !== undefined ? body.startDate : body.start_date;
    const endDate = body.endDate !== undefined ? body.endDate : body.end_date;
    await commitmentsService.update(userId, workspaceId, id, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(designationId !== undefined && {
        designationId,
      }),
      ...(startDate !== undefined && {
        startDate,
      }),
      ...(endDate !== undefined && {
        endDate,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...((body.isActive ?? body.is_active) !== undefined && {
        isActive: body.isActive ?? body.is_active,
      }),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof commitmentsService.CommitmentTargetError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(
      error,
      "Failed to update giving commitment",
      "An active commitment already covers this recipient and fund",
    );
  }
}
