import { requireAuth } from "@/lib/auth-server";
import * as wsService from "@/lib/db/workspaces";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toWorkspace(row: NonNullable<Awaited<ReturnType<typeof wsService.getById>>>) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    envelope_budgeting_enabled: row.envelopeBudgetingEnabled,
    is_default: row.isDefault,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const row = await wsService.getById(userId, id);
    if (!row) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json({ workspace: toWorkspace(row) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch workspace:", error);
    return NextResponse.json({ error: "Failed to fetch workspace" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const row = await wsService.update(userId, id, {
      name: body.name,
      type: body.type,
      currency: body.currency,
      envelopeBudgetingEnabled:
        body.envelopeBudgetingEnabled ?? body.envelope_budgeting_enabled,
    });

    return NextResponse.json({ workspace: toWorkspace(row) });
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
    console.error("Failed to update workspace:", error);
    return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    await wsService.remove(userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("default workspace")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to delete workspace:", error);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
