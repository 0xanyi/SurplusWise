import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as budgetsService from "@/lib/db/budgets";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    // Normalise snake_case variants the frontend may send
    const input: budgetsService.UpdateInput = {
      ...(body.category !== undefined && { category: body.category }),
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.period !== undefined && { period: body.period }),
      ...((body.startDate ?? body.start_date) !== undefined && {
        startDate: body.startDate ?? body.start_date,
      }),
      ...((body.endDate ?? body.end_date) !== undefined && {
        endDate: body.endDate ?? body.end_date,
      }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    };

    await budgetsService.update(userId, id, input);

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
      (error.message.includes("not found") ||
        error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof Error &&
      error.message.includes("startDate must be")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to update budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id } = await params;

    await budgetsService.remove(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to delete budget:", error);
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 500 },
    );
  }
}
