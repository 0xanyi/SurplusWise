import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as budgetsService from "@/lib/db/budgets";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const budget = await budgetsService.copyForward(userId, workspaceId, id);

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
    console.error("Failed to copy budget forward:", error);
    return NextResponse.json({ error: "Failed to copy budget forward" }, { status: 500 });
  }
}
