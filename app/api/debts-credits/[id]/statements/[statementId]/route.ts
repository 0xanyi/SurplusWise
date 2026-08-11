import { requireAuth } from "@/lib/auth-server";
import * as statementsService from "@/lib/db/debt-statements";
import { errorResponse } from "@/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; statementId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth();
    const { id, statementId } = await params;
    const body = await request.json();

    const pick = <T>(camel: T, snake: T) => (camel !== undefined ? camel : snake);

    await statementsService.updateStatement(userId, id, statementId, {
      ...(pick(body.periodStart, body.period_start) !== undefined && {
        periodStart: pick(body.periodStart, body.period_start),
      }),
      ...(pick(body.periodEnd, body.period_end) !== undefined && {
        periodEnd: pick(body.periodEnd, body.period_end),
      }),
      ...(pick(body.statementDate, body.statement_date) !== undefined && {
        statementDate: pick(body.statementDate, body.statement_date),
      }),
      ...(pick(body.dueDate, body.due_date) !== undefined && {
        dueDate: pick(body.dueDate, body.due_date),
      }),
      ...(pick(body.openingBalance, body.opening_balance) !== undefined && {
        openingBalance: pick(body.openingBalance, body.opening_balance),
      }),
      ...(pick(body.closingBalance, body.closing_balance) !== undefined && {
        closingBalance: pick(body.closingBalance, body.closing_balance),
      }),
      ...(pick(body.interestCharged, body.interest_charged) !== undefined && {
        interestCharged: pick(body.interestCharged, body.interest_charged),
      }),
      ...(pick(body.feesCharged, body.fees_charged) !== undefined && {
        feesCharged: pick(body.feesCharged, body.fees_charged),
      }),
      ...(pick(body.newSpending, body.new_spending) !== undefined && {
        newSpending: pick(body.newSpending, body.new_spending),
      }),
      ...(pick(body.minimumPayment, body.minimum_payment) !== undefined && {
        minimumPayment: pick(body.minimumPayment, body.minimum_payment),
      }),
      ...(pick(body.balanceSubjectToInterest, body.balance_subject_to_interest) !==
        undefined && {
        balanceSubjectToInterest: pick(
          body.balanceSubjectToInterest,
          body.balance_subject_to_interest,
        ),
      }),
      ...(pick(body.principalPaid, body.principal_paid) !== undefined && {
        principalPaid: pick(body.principalPaid, body.principal_paid),
      }),
      ...(pick(body.interestPaid, body.interest_paid) !== undefined && {
        interestPaid: pick(body.interestPaid, body.interest_paid),
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to update statement");
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const userId = await requireAuth();
    const { id, statementId } = await params;

    await statementsService.removeStatement(userId, id, statementId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete statement");
  }
}
