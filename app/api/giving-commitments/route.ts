import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as commitmentsService from "@/lib/db/giving-commitments";

function currentYearRange() {
  const year = new Date().getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const defaults = currentYearRange();
    const startDate = request.nextUrl.searchParams.get("startDate") ?? defaults.startDate;
    const endDate = request.nextUrl.searchParams.get("endDate") ?? defaults.endDate;
    const progress = await commitmentsService.getProgress(
      userId,
      workspaceId,
      startDate,
      endDate,
    );
    return NextResponse.json({
      period_start: progress.periodStart,
      period_end: progress.periodEnd,
      expected: progress.expected,
      recorded: progress.recorded,
      income_context: {
        income: progress.periodIncome,
        giving: progress.periodGiving,
        giving_rate: progress.givingRate,
      },
      commitments: progress.rows.map((row) => ({
        id: row.id,
        recipient_id: row.recipientId,
        recipient_name: row.recipientName,
        designation_id: row.designationId,
        designation_name: row.designationName,
        name: row.name,
        amount: Number(row.amount),
        frequency: row.frequency,
        start_date: row.startDate,
        end_date: row.endDate,
        notes: row.notes,
        is_active: row.isActive,
        expected: row.expected,
        recorded: row.recorded,
        variance: row.variance,
      })),
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch giving commitments");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();
    const row = await commitmentsService.create(userId, workspaceId, {
      recipientId: body.recipientId ?? body.recipient_id,
      designationId: body.designationId ?? body.designation_id ?? null,
      name: body.name,
      amount: body.amount,
      frequency: body.frequency,
      startDate: body.startDate ?? body.start_date,
      endDate: body.endDate ?? body.end_date ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    if (error instanceof commitmentsService.CommitmentTargetError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(
      error,
      "Failed to create giving commitment",
      "An active commitment already covers this recipient and fund",
    );
  }
}
