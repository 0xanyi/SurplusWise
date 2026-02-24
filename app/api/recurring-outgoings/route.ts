import { requireAuth } from "@/lib/auth-server";
import * as outgoingsService from "@/lib/db/recurring-outgoings";
import * as paymentLogService from "@/lib/db/outgoing-payment-logs";
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

function getCurrentPeriodMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export async function GET() {
  try {
    const userId = await requireAuth();
    const outgoings = await outgoingsService.list(userId);
    const summary = await outgoingsService.getMonthlyTotal(userId);

    // Get payment status for current month
    const periodMonth = getCurrentPeriodMonth();
    const paymentMap = await paymentLogService.getMonthlyStatus(userId, periodMonth);

    const outgoingsWithStatus = outgoings.map((o) => {
      const mapped = toOutgoing(o);
      const payment = paymentMap.get(o.id);
      return {
        ...mapped,
        payment_status: payment
          ? {
              paid: true,
              payment_id: payment.id,
              amount_paid: payment.amount,
              paid_at: payment.paidAt,
            }
          : { paid: false },
      };
    });

    return NextResponse.json({
      outgoings: outgoingsWithStatus,
      monthly_total: summary.total,
      active_count: summary.count,
      period_month: periodMonth,
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
