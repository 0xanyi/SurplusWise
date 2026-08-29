import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ACCRUAL_MONTHS,
  accrueLoanInterest,
  addMonthsIso,
  deriveLoanStatus,
  findLoanSettlementDate,
  monthsElapsed,
  type LoanInterestInput,
} from "./loan-interest";

/** £10,000 lent on 15 January at 3.5% a month — the worked example throughout. */
function loan(overrides: Partial<LoanInterestInput> = {}): LoanInterestInput {
  return {
    principal: 10_000,
    monthlyRatePercent: 3.5,
    loanDate: "2025-01-15",
    repayments: [],
    asOf: "2025-01-15",
    ...overrides,
  };
}

// ─── Whole-month clock ───────────────────────────────────────────────────────

test("a charge lands on the anniversary, not the day before it", () => {
  // The cliff is the feature: "clear it before the 15th and you save a month"
  // is the only leverage an informal lender has, so the boundary must be exact.
  assert.equal(monthsElapsed("2025-01-15", "2025-02-14"), 0);
  assert.equal(monthsElapsed("2025-01-15", "2025-02-15"), 1);

  assert.equal(accrueLoanInterest(loan({ asOf: "2025-02-14" })).accruedInterest, 0);
  assert.equal(accrueLoanInterest(loan({ asOf: "2025-02-15" })).accruedInterest, 350);
});

test("forty days is one month of interest, not one and a third", () => {
  // Whole months, never pro-rata. 1.33 months would be £466.67.
  const schedule = accrueLoanInterest(loan({ asOf: "2025-02-24" }));
  assert.equal(schedule.monthsElapsed, 1);
  assert.equal(schedule.accruedInterest, 350);
});

test("the anchor day survives a short month rather than being lost to it", () => {
  // A loan taken on the 31st must not drift to the 28th for the rest of its
  // life; February clamps, March restores.
  assert.equal(addMonthsIso("2025-01-31", 1), "2025-02-28");
  assert.equal(addMonthsIso("2025-01-31", 2), "2025-03-31");
  assert.equal(addMonthsIso("2024-01-31", 1), "2024-02-29");

  // 30 March is still only one month after 31 January, because the second
  // anniversary is the 31st.
  assert.equal(monthsElapsed("2025-01-31", "2025-03-30"), 1);
  assert.equal(monthsElapsed("2025-01-31", "2025-03-31"), 2);
});

test("nothing accrues before the money has been lent", () => {
  assert.equal(accrueLoanInterest(loan({ asOf: "2024-12-01" })).accruedInterest, 0);
  assert.equal(monthsElapsed("2025-01-15", "2025-01-15"), 0);
});

// ─── Simple, non-compounding ─────────────────────────────────────────────────

test("interest is simple, so ten months is ten equal charges", () => {
  // Compounding the same rate over ten months would be £4,105.98. Choosing the
  // lower figure is deliberate: it under-recovers rather than over-charges.
  const schedule = accrueLoanInterest(loan({ asOf: "2025-11-15" }));
  assert.equal(schedule.monthsElapsed, 10);
  assert.equal(schedule.accruedInterest, 3500);
});

test("an overrun keeps charging at the same flat rate", () => {
  // The whole point of the feature: they said ten months, they took fourteen.
  assert.equal(accrueLoanInterest(loan({ asOf: "2026-03-15" })).accruedInterest, 4900);
});

// ─── Declining balance ───────────────────────────────────────────────────────

test("a part-payment reduces every later month's charge", () => {
  // £4,000 back during month five: five months on £10,000 (£1,750) then nine
  // on £6,000 (£1,890). Charging the original principal throughout would give
  // £4,900 and would punish them for paying early.
  const schedule = accrueLoanInterest(
    loan({
      asOf: "2026-03-15",
      repayments: [{ amount: 4000, repaymentDate: "2025-05-20" }],
    }),
  );

  assert.equal(schedule.accruedInterest, 3640);
  assert.equal(schedule.months[4].charge, 350);
  assert.equal(schedule.months[5].openingBalance, 6000);
  assert.equal(schedule.months[5].charge, 210);
  assert.equal(schedule.principalOutstanding, 6000);
  assert.equal(schedule.payoffToday, 9640);
});

test("paying on the anniversary saves that month, not just the next", () => {
  // Repayments dated on the opening anniversary count against it. The generous
  // reading, and the one that matches how the saving gets described.
  const schedule = accrueLoanInterest(
    loan({
      asOf: "2025-06-15",
      repayments: [{ amount: 4000, repaymentDate: "2025-05-15" }],
    }),
  );

  assert.equal(schedule.monthsElapsed, 5);
  assert.equal(schedule.months[4].openingBalance, 6000);
  assert.equal(schedule.accruedInterest, 1610);
});

// ─── Allocation: principal first ─────────────────────────────────────────────

test("cash above principal becomes interest paid instead of vanishing", () => {
  // Today `Math.max(0, balance - amount)` in addRepayment discards this £4,900
  // silently. Allocation makes the excess mean something.
  const schedule = accrueLoanInterest(
    loan({
      asOf: "2026-03-15",
      repayments: [{ amount: 14_900, repaymentDate: "2026-03-15" }],
    }),
  );

  assert.equal(schedule.accruedInterest, 4900);
  assert.equal(schedule.principalPaid, 10_000);
  assert.equal(schedule.principalOutstanding, 0);
  assert.equal(schedule.interestPaid, 4900);
  assert.equal(schedule.interestOutstanding, 0);
  assert.equal(schedule.payoffToday, 0);
  assert.equal(schedule.isSettled, true);
});

test("clearing the principal alone leaves the interest owed", () => {
  // The status this drives must not claim the loan is repaid while £4,900 of
  // interest sits outstanding next to it.
  const schedule = accrueLoanInterest(
    loan({
      asOf: "2026-03-15",
      repayments: [{ amount: 10_000, repaymentDate: "2026-03-15" }],
    }),
  );

  assert.equal(schedule.principalOutstanding, 0);
  assert.equal(schedule.interestOutstanding, 4900);
  assert.equal(schedule.payoffToday, 4900);
  assert.equal(schedule.isSettled, false);
  assert.equal(deriveLoanStatus(schedule, false), "partially_repaid");
});

// ─── No rate agreed ──────────────────────────────────────────────────────────

test("an interest-free loan produces no schedule at all", () => {
  // `null` (never agreed) and `0` (agreed at nothing) keep their distinction in
  // the column but derive identically: fourteen rows of £0.00 is noise.
  for (const monthlyRatePercent of [null, 0]) {
    const schedule = accrueLoanInterest(loan({ monthlyRatePercent, asOf: "2026-03-15" }));
    assert.deepEqual(schedule.months, []);
    assert.equal(schedule.accruedInterest, 0);
    assert.equal(schedule.payoffToday, 10_000);
  }
});

// ─── Rounding ────────────────────────────────────────────────────────────────

test("schedule rows sum to the headline figure", () => {
  // A borrower who adds up the table must reach the number printed under it.
  // Rounding only the total would leave the rows a penny short of it.
  const schedule = accrueLoanInterest(
    loan({ principal: 1234.56, monthlyRatePercent: 2.75, asOf: "2025-05-15" }),
  );

  assert.equal(schedule.monthsElapsed, 4);
  assert.equal(schedule.months[0].charge, 33.95);
  assert.equal(schedule.accruedInterest, 135.8);
  assert.equal(
    Math.round(schedule.months.reduce((sum, month) => sum + month.charge, 0) * 100) / 100,
    schedule.accruedInterest,
  );
});

// ─── Writing a loan off stops the clock ──────────────────────────────────────

test("a frozen loan stops accruing at the date it was written off", () => {
  // Without this an unpaid £10,000 reaches £21,000 of interest by year five —
  // a figure nobody would ever put in front of a borrower.
  const stopped = accrueLoanInterest(
    loan({ asOf: "2027-01-15", accrualStoppedOn: "2026-03-15" }),
  );
  assert.equal(stopped.accruedInterest, 4900);

  // Same loan, same date, clock still running.
  assert.equal(accrueLoanInterest(loan({ asOf: "2027-01-15" })).accruedInterest, 8400);
});

test("a stop date in the future does not curtail accrual", () => {
  const schedule = accrueLoanInterest(
    loan({ asOf: "2025-11-15", accrualStoppedOn: "2026-06-01" }),
  );
  assert.equal(schedule.accruedInterest, 3500);
});

// ─── Status ──────────────────────────────────────────────────────────────────

test("a written-off judgement outranks anything the ledger implies", () => {
  // `defaulted` is the one status arithmetic cannot infer.
  const settled = accrueLoanInterest(
    loan({ asOf: "2026-03-15", repayments: [{ amount: 14_900, repaymentDate: "2026-03-15" }] }),
  );
  assert.equal(deriveLoanStatus(settled, false), "fully_repaid");
  assert.equal(deriveLoanStatus(settled, true), "defaulted");
});

test("an untouched loan is active, not partially repaid", () => {
  assert.equal(deriveLoanStatus(accrueLoanInterest(loan({ asOf: "2026-03-15" })), false), "active");
});

// ─── Settlement date ─────────────────────────────────────────────────────────

test("settlement is dated from the repayment that cleared it", () => {
  // Three months in, £10,000 principal plus £1,050 interest. Paying exactly
  // that settles the loan, and accrual must stop there rather than run on.
  const input = {
    ...loan({ repayments: [{ amount: 11_050, repaymentDate: "2025-04-15" }] }),
  };
  assert.equal(findLoanSettlementDate(input), "2025-04-15");

  const settled = accrueLoanInterest({ ...input, asOf: "2025-04-15" });
  assert.equal(settled.accruedInterest, 1050);
  assert.equal(settled.isSettled, true);
});

test("an underpaid loan has no settlement date", () => {
  const input = loan({ repayments: [{ amount: 5000, repaymentDate: "2025-04-15" }] });
  assert.equal(findLoanSettlementDate(input), null);
});

// ─── Bounds ──────────────────────────────────────────────────────────────────

test("an implausible date cannot build an unbounded schedule", () => {
  // `9999-12-31` is ~95,700 monthly periods: ~72ms of blocked event loop and
  // ~95,700 allocations per loan, per request. Validation rejects dates that
  // far out; this clamp catches rows written before that bound existed.
  const schedule = accrueLoanInterest(loan({ asOf: "9999-12-31" }));

  assert.equal(schedule.monthsElapsed, MAX_ACCRUAL_MONTHS);
  assert.equal(schedule.months.length, MAX_ACCRUAL_MONTHS);
});

test("a repayment dated in the future does not count yet", () => {
  // The stored `outstanding_balance` is written from this schedule, so if a
  // future-dated repayment counted here but not there — or the reverse — the
  // loan page would show a settled principal beside interest still accruing
  // on the full amount.
  const schedule = accrueLoanInterest(
    loan({
      asOf: "2026-03-15",
      repayments: [{ amount: 10_000, repaymentDate: "2027-01-01" }],
    }),
  );

  assert.equal(schedule.principalPaid, 0);
  assert.equal(schedule.principalOutstanding, 10_000);
  assert.equal(schedule.accruedInterest, 4900);
  assert.equal(schedule.payoffToday, 14_900);
  assert.equal(schedule.isSettled, false);
});
