import { requireAuth } from "@/lib/auth-server";
import * as outgoingsService from "@/lib/db/recurring-outgoings";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const input: outgoingsService.UpdateInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...((body.dayOfMonth ?? body.day_of_month) !== undefined && {
        dayOfMonth: body.dayOfMonth ?? body.day_of_month,
      }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    };

    await outgoingsService.update(userId, id, input);

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
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to update recurring outgoing:", error);
    return NextResponse.json(
      { error: "Failed to update recurring outgoing" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;

    await outgoingsService.remove(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to delete recurring outgoing:", error);
    return NextResponse.json(
      { error: "Failed to delete recurring outgoing" },
      { status: 500 },
    );
  }
}
