import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as outgoingsService from "@/lib/db/recurring-outgoings";
import * as paymentLogService from "@/lib/db/outgoing-payment-logs";
import { errorResponse } from "@/lib/api-errors";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";
import { NextRequest, NextResponse } from "next/server";

function toOutgoing(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    day_of_month: row.dayOfMonth,
    frequency: row.frequency,
    category: row.category,
    vendor: row.vendor ?? null,
    client_id: row.clientId ?? null,
    client_name: row.clientName ?? null,
    rebill_mode: row.rebillMode ?? "none",
    rebill_amount: row.rebillAmount == null ? null : Number(row.rebillAmount),
    notes: row.notes,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function getCurrentPeriodMonth() {
  return getPeriodMonthFromDate(getCurrentUtcDate());
}

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const outgoings = await outgoingsService.list(userId, workspaceId);
    const summary = await outgoingsService.getMonthlyTotal(userId, workspaceId);

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
      // The two halves of monthly_total: what the workspace carries itself and
      // what it fronts for someone. Never netted against each other.
      monthly_overhead: summary.overhead,
      monthly_pass_through: summary.passThrough,
      active_count: summary.count,
      period_month: periodMonth,
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch recurring outgoings");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const row = await outgoingsService.create(userId, workspaceId, {
      name: body.name,
      amount: body.amount,
      dayOfMonth: body.dayOfMonth ?? body.day_of_month,
      frequency: body.frequency,
      category: body.category,
      vendor: body.vendor,
      clientId: body.clientId ?? body.client_id,
      rebillMode: body.rebillMode ?? body.rebill_mode,
      rebillAmount: body.rebillAmount ?? body.rebill_amount,
      notes: body.notes,
    });

    return NextResponse.json({ id: row.id });
  } catch (error) {
    return errorResponse(error, "Failed to create recurring outgoing");
  }
}
