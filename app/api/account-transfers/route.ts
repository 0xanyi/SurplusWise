import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as accountService from "@/lib/db/financial-accounts";

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const transfers = await accountService.listTransfers(userId, workspaceId);
    return NextResponse.json({
      transfers: transfers.map((row) => ({
        id: row.id,
        from_account_id: row.fromAccountId,
        to_account_id: row.toAccountId,
        amount: Number(row.amount),
        date: row.date,
        notes: row.notes,
        created_at: row.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to list transfers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await accountService.createTransfer(userId, workspaceId, {
      fromAccountId: body.fromAccountId ?? body.from_account_id,
      toAccountId: body.toAccountId ?? body.to_account_id,
      amount: body.amount,
      date: body.date,
      notes: body.notes,
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
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
    const message = error instanceof Error ? error.message : "Failed to create transfer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
