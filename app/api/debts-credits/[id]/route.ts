import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as debtsService from "@/lib/db/debts-credits";
import { errorResponse } from "@/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;

    const row = await debtsService.getById(userId, id);

    return NextResponse.json({
      debt: {
        id: row.id,
        name: row.name,
        debt_type: row.debtType,
        lender: row.lender,
        current_balance: Number(row.currentBalance),
        credit_limit: row.creditLimit != null ? Number(row.creditLimit) : null,
        interest_rate: row.interestRate != null ? Number(row.interestRate) : null,
        minimum_payment: row.minimumPayment != null ? Number(row.minimumPayment) : null,
        min_payment_percent:
          row.minPaymentPercent != null ? Number(row.minPaymentPercent) : null,
        min_payment_floor: row.minPaymentFloor != null ? Number(row.minPaymentFloor) : null,
        payment_day_of_month: row.paymentDayOfMonth,
        start_date: row.startDate,
        end_date: row.endDate,
        notes: row.notes,
        is_active: row.isActive,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      },
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch debt/credit");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    const input: debtsService.UpdateInput = {
      ...(body.name !== undefined && { name: body.name }),
      ...((body.debtType ?? body.debt_type) !== undefined && {
        debtType: body.debtType ?? body.debt_type,
      }),
      ...(body.lender !== undefined && { lender: body.lender }),
      ...((body.currentBalance ?? body.current_balance) !== undefined && {
        currentBalance: body.currentBalance ?? body.current_balance,
      }),
      ...((body.creditLimit ?? body.credit_limit) !== undefined && {
        creditLimit: body.creditLimit ?? body.credit_limit,
      }),
      ...((body.interestRate ?? body.interest_rate) !== undefined && {
        interestRate: body.interestRate ?? body.interest_rate,
      }),
      ...((body.minimumPayment ?? body.minimum_payment) !== undefined && {
        minimumPayment: body.minimumPayment ?? body.minimum_payment,
      }),
      ...((body.minPaymentPercent ?? body.min_payment_percent) !== undefined && {
        minPaymentPercent: body.minPaymentPercent ?? body.min_payment_percent,
      }),
      ...((body.minPaymentFloor ?? body.min_payment_floor) !== undefined && {
        minPaymentFloor: body.minPaymentFloor ?? body.min_payment_floor,
      }),
      ...((body.paymentDayOfMonth ?? body.payment_day_of_month) !== undefined && {
        paymentDayOfMonth: body.paymentDayOfMonth ?? body.payment_day_of_month,
      }),
      ...((body.startDate ?? body.start_date) !== undefined && {
        startDate: body.startDate ?? body.start_date,
      }),
      ...((body.endDate ?? body.end_date) !== undefined && {
        endDate: body.endDate ?? body.end_date,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    };

    await debtsService.update(userId, id, input);

    return NextResponse.json({ success: true });
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
    console.error("Failed to update debt/credit:", error);
    return NextResponse.json(
      { error: "Failed to update debt/credit" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuthWithWorkspace();
    const { id } = await params;

    await debtsService.remove(userId, id);

    return NextResponse.json({ success: true });
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
    console.error("Failed to delete debt/credit:", error);
    return NextResponse.json(
      { error: "Failed to delete debt/credit" },
      { status: 500 },
    );
  }
}
