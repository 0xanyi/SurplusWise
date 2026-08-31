import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import { getCurrentUtcDate, getPeriodMonthFromDate } from "@/lib/outgoings-date";
import * as recurringMoneyOccurrences from "@/lib/recurring-money-occurrences";
import { toOccurrence } from "./serialize";

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const periodMonth =
      request.nextUrl.searchParams.get("periodMonth") ??
      getPeriodMonthFromDate(getCurrentUtcDate());
    const result = await recurringMoneyOccurrences.month(workspaceId, periodMonth);
    return NextResponse.json({
      period_month: result.periodMonth,
      occurrences: result.occurrences.map(toOccurrence),
      settled: result.occurrences.filter((occurrence) => occurrence.status === "settled").length,
      overpaid: result.occurrences.filter((occurrence) => occurrence.status === "overpaid").length,
      partial: result.occurrences.filter((occurrence) => occurrence.status === "partial").length,
      outstanding: result.occurrences.filter(
        (occurrence) => occurrence.status === "unsettled" || occurrence.status === "partial",
      ).length,
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch Recurring money occurrences");
  }
}
