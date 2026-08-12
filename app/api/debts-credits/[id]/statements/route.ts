import { requireAuth } from "@/lib/auth-server";
import * as statementsService from "@/lib/db/debt-statements";
import { errorResponse } from "@/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";

type Statement = Awaited<ReturnType<typeof statementsService.listStatements>>[number];

function toStatement(row: Statement) {
  return {
    id: row.id,
    debt_id: row.debtId,
    period_start: row.periodStart,
    period_end: row.periodEnd,
    statement_date: row.statementDate,
    due_date: row.dueDate,
    opening_balance: row.openingBalance,
    closing_balance: row.closingBalance,
    interest_charged: row.interestCharged,
    fees_charged: row.feesCharged,
    new_spending: row.newSpending,
    minimum_payment: row.minimumPayment,
    balance_subject_to_interest: row.balanceSubjectToInterest,
    principal_paid: row.principalPaid,
    interest_paid: row.interestPaid,
    notes: row.notes,
    payments_in_period: row.paymentsInPeriod,
    residual: row.residual,
    residual_significant: row.residualSignificant,
    advertised_apr: row.advertisedApr,
    rate: row.rate && {
      period_rate_percent: row.rate.periodRatePercent,
      annualised_percent: row.rate.annualisedPercent,
      basis: row.rate.basis,
      estimated: row.rate.estimated,
      period_days: row.rate.periodDays,
    },
    interest_breakdown:
      row.interestBreakdown?.map((bucket) => ({
        type: bucket.type,
        label: bucket.label,
        balance_subject_to_interest: bucket.balanceSubjectToInterest,
        interest_charged: bucket.interestCharged,
        apr: bucket.apr,
        rate: bucket.rate && {
          period_rate_percent: bucket.rate.periodRatePercent,
          annualised_percent: bucket.rate.annualisedPercent,
          basis: bucket.rate.basis,
          estimated: bucket.rate.estimated,
          period_days: bucket.rate.periodDays,
        },
        rate_variance: bucket.rateVariance,
      })) ?? null,
    created_at: row.createdAt,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;

    const [statements, draft] = await Promise.all([
      statementsService.listStatements(userId, id),
      statementsService.getStatementDraft(userId, id),
    ]);

    return NextResponse.json({
      statements: statements.map(toStatement),
      draft: {
        period_start: draft.periodStart,
        opening_balance: draft.openingBalance,
        suggested_minimum: draft.suggestedMinimum,
        has_previous: draft.hasPrevious,
      },
    });
  } catch (error) {
    return errorResponse(error, "Failed to fetch statements");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const statement = await statementsService.createStatement(userId, id, {
      periodStart: body.periodStart ?? body.period_start,
      periodEnd: body.periodEnd ?? body.period_end,
      statementDate: body.statementDate ?? body.statement_date,
      dueDate: body.dueDate ?? body.due_date,
      openingBalance: body.openingBalance ?? body.opening_balance,
      closingBalance: body.closingBalance ?? body.closing_balance,
      interestCharged: body.interestCharged ?? body.interest_charged,
      feesCharged: body.feesCharged ?? body.fees_charged,
      newSpending: body.newSpending ?? body.new_spending,
      minimumPayment: body.minimumPayment ?? body.minimum_payment,
      balanceSubjectToInterest:
        body.balanceSubjectToInterest ?? body.balance_subject_to_interest,
      interestBreakdown: body.interestBreakdown ?? body.interest_breakdown,
      principalPaid: body.principalPaid ?? body.principal_paid,
      interestPaid: body.interestPaid ?? body.interest_paid,
      notes: body.notes,
    });

    return NextResponse.json({ id: statement.id });
  } catch (error) {
    return errorResponse(error, "Failed to create statement");
  }
}
