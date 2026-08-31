import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as budgetsService from "@/lib/db/budgets";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    const carryRemaining =
      typeof body === "object" &&
      body !== null &&
      "carryRemaining" in body &&
      body.carryRemaining === true;
    const budget = await budgetsService.copyForward(workspaceId, id, {
      carryRemaining,
    });

    return NextResponse.json({ id: budget.id });
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
    if (
      error instanceof Error &&
      (error.message.includes("already been copied") || error.message.includes("already exists"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes("Rollover is only available")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to copy budget forward:", error);
    return NextResponse.json({ error: "Failed to copy budget forward" }, { status: 500 });
  }
}
