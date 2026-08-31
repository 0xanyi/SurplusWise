import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as debtsService from "@/lib/db/debts-credits";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    debt_id: row.debtId,
    balance: Number(row.balance),
    notes: row.notes,
    logged_at: row.loggedAt,
    created_at: row.createdAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;

    const logs = await debtsService.listBalanceLogs(workspaceId, id);

    return NextResponse.json({ logs: logs.map(toLog) });
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
    console.error("Failed to fetch balance logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance logs" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    const log = await debtsService.addBalanceLog(workspaceId, id, {
      balance: body.balance,
      notes: body.notes,
      loggedAt: body.loggedAt ?? body.logged_at,
    });

    return NextResponse.json({ id: log.id });
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
    console.error("Failed to create balance log:", error);
    return NextResponse.json(
      { error: "Failed to create balance log" },
      { status: 500 },
    );
  }
}
