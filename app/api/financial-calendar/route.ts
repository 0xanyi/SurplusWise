import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as calendarService from "@/lib/db/financial-calendar";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";
import { periodMonthSchema } from "@/lib/db/validation";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const parsedBody: unknown = await request.json().catch(() => ({}));
    const body =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as Record<string, unknown>)
        : {};
    const periodMonth = periodMonthSchema.parse(
      body.periodMonth ??
        body.period_month ??
        getPeriodMonthFromDate(getCurrentUtcDate()),
    );
    const calendar = await calendarService.getMonth(workspaceId, periodMonth);
    return NextResponse.json({
      period_month: calendar.periodMonth,
      events: calendar.events.map((event) => ({
        id: event.id,
        source_id: event.sourceId,
        source: event.source,
        date: event.date,
        title: event.title,
        amount: event.amount,
        type: event.type,
        status: event.status,
        certainty: event.certainty,
        recorded_amount: event.recordedAmount,
        outstanding_amount: event.outstandingAmount,
        href: event.href,
      })),
      summary: {
        expected_income: calendar.summary.expectedIncome,
        expected_outflow: calendar.summary.expectedOutflow,
        incoming_outstanding: calendar.summary.incomingOutstanding,
        outgoing_outstanding: calendar.summary.outgoingOutstanding,
      },
    });
  } catch (error) {
    return errorResponse(error, "Failed to load financial calendar");
  }
}
