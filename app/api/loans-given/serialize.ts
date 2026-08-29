import type * as loansService from "@/lib/db/loans-given";
import type { ApiLoanGiven, ApiLoanInterestMonth } from "@/types";

/**
 * Snake-case wire shape for a loan and its derived interest.
 *
 * Colocated rather than living in either `route.ts`, because App Router route
 * files may only export handlers — and duplicating the serializer per route,
 * as the debts endpoints do, is how two copies drift apart.
 *
 * The monthly schedule is deliberately absent here: a list card shows totals,
 * and shipping fourteen rows per loan would bloat the response for figures only
 * the detail page draws.
 */
export function toLoan({ row, interest }: loansService.LoanWithInterest): ApiLoanGiven {
  return {
    id: row.id,
    borrower_name: row.borrowerName,
    amount: Number(row.amount),
    outstanding_balance: Number(row.outstandingBalance),
    loan_date: row.loanDate,
    expected_payback_date: row.expectedPaybackDate,
    status: row.status,
    interest_rate: row.interestRate != null ? Number(row.interestRate) : null,
    accrual_stopped_on: row.accrualStoppedOn,
    notes: row.notes,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
    interest: {
      months_elapsed: interest.monthsElapsed,
      accrued_interest: interest.accruedInterest,
      interest_paid: interest.interestPaid,
      interest_outstanding: interest.interestOutstanding,
      payoff_today: interest.payoffToday,
      expected_interest: interest.expectedInterest,
      final_interest: interest.finalInterest,
      settled_on: interest.settledOn,
    },
  };
}

/** The schedule rows, only ever sent for a single loan. */
export function toSchedule(
  months: loansService.LoanWithInterest["interest"]["months"],
): ApiLoanInterestMonth[] {
  return months.map((month) => ({
    index: month.index,
    period_start: month.periodStart,
    period_end: month.periodEnd,
    charged_on: month.chargedOn,
    opening_balance: month.openingBalance,
    charge: month.charge,
  }));
}
