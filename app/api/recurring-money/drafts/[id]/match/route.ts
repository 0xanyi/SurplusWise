import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as draftsService from "@/lib/db/recurring-money-drafts";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const transactionId = body.transactionId ?? body.transaction_id;
    const row = await draftsService.matchTransaction(
      userId,
      workspaceId,
      id,
      transactionId,
    );
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already matched")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("type must match")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to match recurring money draft");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const transactionId =
      request.nextUrl.searchParams.get("transactionId") ??
      request.nextUrl.searchParams.get("transaction_id") ??
      "";
    await draftsService.unmatch(userId, workspaceId, id, transactionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to unmatch recurring money draft");
  }
}
