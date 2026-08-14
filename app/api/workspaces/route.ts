import { requireAuth } from "@/lib/auth-server";
import * as wsService from "@/lib/db/workspaces";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toWorkspace(row: Awaited<ReturnType<typeof wsService.list>>[number]) {
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

export async function GET() {
  try {
    const userId = await requireAuth();
    const rows = await wsService.list(userId);

    // If user has no workspaces yet, create the default one
    if (rows.length === 0) {
      const defaultWs = await wsService.getOrCreateDefault(userId);
      return NextResponse.json({ workspaces: [toWorkspace(defaultWs)] });
    }

    return NextResponse.json({ workspaces: rows.map(toWorkspace) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch workspaces:", error);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const row = await wsService.create(userId, {
      name: body.name,
      type: body.type,
      currency: body.currency,
    });

    return NextResponse.json({ workspace: toWorkspace(row) }, { status: 201 });
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
    console.error("Failed to create workspace:", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
