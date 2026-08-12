import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as rulesService from "@/lib/db/transaction-rules";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();
    const transactionType =
      body.transactionType !== undefined ? body.transactionType : body.transaction_type;
    const clientId = body.clientId !== undefined ? body.clientId : body.client_id;
    await rulesService.update(userId, workspaceId, id, {
      ...(body.name !== undefined && { name: body.name }),
      ...((body.matchField ?? body.match_field) !== undefined && {
        matchField: body.matchField ?? body.match_field,
      }),
      ...((body.matchValue ?? body.match_value) !== undefined && {
        matchValue: body.matchValue ?? body.match_value,
      }),
      ...(transactionType !== undefined && {
        transactionType,
      }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(clientId !== undefined && {
        clientId,
      }),
      ...((body.markReviewed ?? body.mark_reviewed) !== undefined && {
        markReviewed: body.markReviewed ?? body.mark_reviewed,
      }),
      ...((body.isActive ?? body.is_active) !== undefined && {
        isActive: body.isActive ?? body.is_active,
      }),
      ...(body.priority !== undefined && { priority: body.priority }),
    });
    return NextResponse.json({ success: true });
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
    const message = error instanceof Error ? error.message : "Failed to update transaction rule";
    const status = message.includes("not found")
      ? 404
      : message.includes("already exists")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    await rulesService.remove(userId, workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete transaction rule";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
