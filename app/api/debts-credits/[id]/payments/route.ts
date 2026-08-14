import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as statementsService from "@/lib/db/debt-statements";
import { errorResponse } from "@/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;

    const payments = await statementsService.listPayments(userId, id);

    return NextResponse.json({
      payments: payments.map((row) => ({
        id: row.id,
        debt_id: row.debtId,
        amount: row.amount,
        paid_at: row.paidAt,
        notes: row.notes,
        created_at: row.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch payments");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    const payment = await statementsService.createPayment(userId, id, {
      amount: body.amount,
      paidAt: body.paidAt ?? body.paid_at,
      notes: body.notes,
    });

    return NextResponse.json({ id: payment.id });
  } catch (error) {
    return errorResponse(error, "Failed to record payment");
  }
}
