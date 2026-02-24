import { requireAuth } from "@/lib/auth-server";
import * as outgoingsService from "@/lib/db/recurring-outgoings";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

function toOutgoing(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    day_of_month: row.dayOfMonth,
    frequency: row.frequency,
    category: row.category,
    notes: row.notes,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function GET() {
  try {
    const userId = await requireAuth();
    const outgoings = await outgoingsService.list(userId);
    const summary = await outgoingsService.getMonthlyTotal(userId);

    return NextResponse.json({
      outgoings: outgoings.map(toOutgoing),
      monthly_total: summary.total,
      active_count: summary.count,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch recurring outgoings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recurring outgoings" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const row = await outgoingsService.create(userId, {
      name: body.name,
      amount: body.amount,
      dayOfMonth: body.dayOfMonth ?? body.day_of_month,
      frequency: body.frequency,
      category: body.category,
      notes: body.notes,
    });

    return NextResponse.json({ id: row.id });
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
    console.error("Failed to create recurring outgoing:", error);
    return NextResponse.json(
      { error: "Failed to create recurring outgoing" },
      { status: 500 },
    );
  }
}
