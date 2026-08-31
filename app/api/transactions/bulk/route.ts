import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as txService from "@/lib/db/transactions";

export async function PATCH(request: NextRequest) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const ids = await txService.bulkUpdateMetadata(workspaceId, {
      ids: body.ids,
      ...(body.needsReview !== undefined && { needsReview: body.needsReview }),
      ...("assignedToUserId" in body && { assignedToUserId: body.assignedToUserId }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.payee !== undefined && { payee: body.payee }),
    }, actorUserId);
    return NextResponse.json({ updated: ids.length, ids });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update transactions" }, { status: 500 });
  }
}
