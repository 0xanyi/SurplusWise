import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as paymentLogService from "@/lib/db/outgoing-payment-logs";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toPaymentLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    outgoing_id: row.outgoingId,
    amount: Number(row.amount),
    paid_at: row.paidAt,
    period_month: row.periodMonth,
    notes: row.notes,
    created_at: row.createdAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id: outgoingId } = await params;

    const logs = await paymentLogService.listForOutgoing(userId, outgoingId, workspaceId);
    return NextResponse.json({ logs: logs.map(toPaymentLog) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to fetch payment logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment logs" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { id: outgoingId } = await params;
    const body = await request.json();

    const requestedPaidAt = body.paidAt ?? body.paid_at;
    const paidAt = requestedPaidAt ?? getCurrentUtcDate();

    if (typeof paidAt !== "string") {
      return NextResponse.json(
        { error: "paidAt must be a date string (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const row = await paymentLogService.create(
      userId,
      outgoingId,
      {
        amount: body.amount,
        paidAt,
        // Canonical period month is derived server-side from paidAt
        periodMonth: getPeriodMonthFromDate(paidAt),
        notes: body.notes,
      },
      workspaceId,
    );

    return NextResponse.json(toPaymentLog(row));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    // Unique constraint violation (duplicate payment for the same month)
    if (
      error instanceof Error &&
      error.message.includes("unique")
    ) {
      return NextResponse.json(
        { error: "Payment already logged for this month" },
        { status: 409 },
      );
    }
    console.error("Failed to create payment log:", error);
    return NextResponse.json(
      { error: "Failed to create payment log" },
      { status: 500 },
    );
  }
}
