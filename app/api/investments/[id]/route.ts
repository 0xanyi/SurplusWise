import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as investmentsService from "@/lib/db/investments";
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

    const input: investmentsService.UpdateInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...((body.investmentType ?? body.investment_type) !== undefined && {
        investmentType: body.investmentType ?? body.investment_type,
      }),
      ...(body.platform !== undefined && { platform: body.platform }),
      ...((body.costBasis ?? body.cost_basis) !== undefined && {
        costBasis: body.costBasis ?? body.cost_basis,
      }),
      ...((body.currentValue ?? body.current_value) !== undefined && {
        currentValue: body.currentValue ?? body.current_value,
      }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...((body.purchaseDate ?? body.purchase_date) !== undefined && {
        purchaseDate: body.purchaseDate ?? body.purchase_date,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    };

    await investmentsService.update(userId, id, input);

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
    console.error("Failed to update investment:", error);
    return NextResponse.json(
      { error: "Failed to update investment" },
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

    await investmentsService.remove(userId, id);

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
    console.error("Failed to delete investment:", error);
    return NextResponse.json(
      { error: "Failed to delete investment" },
      { status: 500 },
    );
  }
}
