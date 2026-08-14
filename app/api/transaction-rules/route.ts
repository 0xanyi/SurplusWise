import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as rulesService from "@/lib/db/transaction-rules";

function toRule(row: Awaited<ReturnType<typeof rulesService.list>>[number]) {
  return {
    id: row.id,
    name: row.name,
    match_field: row.matchField,
    match_value: row.matchValue,
    transaction_type: row.transactionType,
    category: row.category,
    tags: row.tags,
    client_id: row.clientId,
    mark_reviewed: row.markReviewed,
    is_active: row.isActive,
    priority: row.priority,
  };
}

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const rules = await rulesService.list(userId, workspaceId);
    return NextResponse.json({ rules: rules.map(toRule) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to list transaction rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await rulesService.create(userId, workspaceId, {
      name: body.name,
      matchField: body.matchField ?? body.match_field,
      matchValue: body.matchValue ?? body.match_value,
      transactionType: body.transactionType ?? body.transaction_type ?? null,
      category: body.category ?? null,
      tags: body.tags ?? [],
      clientId: body.clientId ?? body.client_id ?? null,
      markReviewed: body.markReviewed ?? body.mark_reviewed ?? false,
      isActive: body.isActive ?? body.is_active ?? true,
      priority: body.priority ?? 100,
    });
    return NextResponse.json({ rule: toRule(row) }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to create transaction rule";
    return NextResponse.json(
      { error: message },
      { status: message.includes("already exists") ? 409 : 400 },
    );
  }
}
