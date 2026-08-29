/**
 * Interest arithmetic for money lent out (`loans_given`).
 *
 * The rate on a loan given is what *you charge the borrower*, not what your
 * funding costs you. Those are different numbers — a card at 24.9% EAR costs
 * ~2.1%/month while you might charge 3.5% — and conflating them would put a
 * figure in front of a borrower that neither of you agreed. Cost-of-funding
 * attribution is deliberately not modelled here.
 *
 * Four rules define every figure below, and they were chosen so the borrower
 * can verify the total in their head:
 *
 *   1. Rates are **per month**. `loans_given.interest_rate` has no other
 *      reading; there is no annual basis to convert from.
 *   2. Interest is **simple** — never compounded. A credit card does compound,
 *      so this slightly under-recovers on long overruns. That is the safer
 *      direction to err when asking a friend for money.
 *   3. It accrues on the **declining principal**, so a part-payment reduces
 *      every later charge.
 *   4. Months are **whole**, ticking on the loan date's day-of-month. Day 40 is
 *      one month, not 1.33. The cliff is the point: "clear it before the 15th
 *      and you save a month" is the only leverage an informal lender has.
 *
 * Nothing here is stored. `outstanding_balance` stays principal-only
 * (`principal − Σ repayments`) so the ledger invariant in `lib/db/loans-given.ts`
 * survives and net worth keeps counting only money that actually left your
 * account. Unpaid interest on an informal loan is not an asset you would bank
 * on. Every figure is recomputed on read, which also means correcting a wrong
 * rate retroactively corrects the history — usually what you want.
 */

import type { LoanStatus } from "@/types";

// ─── Inputs ──────────────────────────────────────────────────────────────────

/** One repayment, reduced to what the arithmetic needs. */
export interface LoanRepaymentEntry {
  amount: number;
  /** Calendar date, `YYYY-MM-DD`. */
  repaymentDate: string;
}

export interface LoanInterestInput {
  /** Original sum handed over. */
  principal: number;
  /**
   * Monthly rate as a percentage. `null` means no interest was agreed; `0`
   * means it was explicitly agreed at nothing. The stored column keeps that
   * distinction of intent, but both produce an empty schedule — a table of
   * fourteen £0.00 rows is noise, not information.
   */
  monthlyRatePercent: number | null;
  loanDate: string;
  repayments: readonly LoanRepaymentEntry[];
  /** Date to accrue up to, typically today. */
  asOf: string;
  /**
   * Date accrual froze, if it has. Set when a loan is written off, so the
   * figure stops growing at a number you can still point to instead of
   * reaching £21,000 of interest on a £10,000 loan by year five.
   */
  accrualStoppedOn?: string | null;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

/** One monthly charge, as it appears in the schedule you show the borrower. */
export interface LoanInterestMonth {
  /** 1-based month number since the loan date. */
  index: number;
  /** Anniversary opening this month; the balance is measured here. */
  periodStart: string;
  /** Day before the next anniversary. */
  periodEnd: string;
  /** Date the charge lands — the anniversary closing this month. */
  chargedOn: string;
  /** Principal still outstanding at `periodStart`. */
  openingBalance: number;
  /** Interest for this month, rounded so the rows sum to the headline. */
  charge: number;
}

export interface LoanInterestSchedule {
  /** Whole monthly anniversaries reached, and so charges levied. */
  monthsElapsed: number;
  months: LoanInterestMonth[];
  /** Sum of every charge levied. */
  accruedInterest: number;
  /** Cash received, capped at principal — repayments settle principal first. */
  principalPaid: number;
  principalOutstanding: number;
  /** Cash received above principal. Today this figure is silently discarded. */
  interestPaid: number;
  interestOutstanding: number;
  /** What clears the loan entirely on `asOf`. The number that ends the call. */
  payoffToday: number;
  /** True when principal *and* accrued interest are both covered. */
  isSettled: boolean;
}

// ─── Date arithmetic ─────────────────────────────────────────────────────────
//
// Loan dates are PostgreSQL `date` read as plain `YYYY-MM-DD` strings, so all
// of this is string and integer work. No `Date` objects, no timezone in which
// a loan taken out on the 1st accrues its first month on the previous day.

function parseIso(iso: string): { year: number; month: number; day: number } {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
  };
}

function formatIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Same day-of-month, `months` later, clamped to the target month's length. A
 * loan taken on 31 January accrues on 28 February, then 31 March — the anchor
 * day is never lost to a short month.
 */
export function addMonthsIso(iso: string, months: number): string {
  const { year, month, day } = parseIso(iso);
  const zeroBased = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;
  return formatIso(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** Day before `iso`, so a month's `periodEnd` never overlaps the next start. */
function previousDayIso(iso: string): string {
  const { year, month, day } = parseIso(iso);
  if (day > 1) return formatIso(year, month, day - 1);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return formatIso(prevYear, prevMonth, daysInMonth(prevYear, prevMonth));
}

/**
 * Whole monthly anniversaries between `loanDate` and `asOf`. A charge counts
 * only once its anniversary has been reached, so a loan on 15 January has
 * levied nothing on 14 February and one month's interest on the 15th.
 */
export function monthsElapsed(loanDate: string, asOf: string): number {
  if (asOf <= loanDate) return 0;
  const from = parseIso(loanDate);
  const to = parseIso(asOf);
  const approximate = (to.year - from.year) * 12 + (to.month - from.month);
  if (approximate <= 0) return 0;
  // Day-of-month clamping makes the calendar difference an over-estimate by at
  // most one: 31 Jan → 28 Feb is a full month, 15 Jan → 14 Feb is not.
  return addMonthsIso(loanDate, approximate) > asOf ? approximate - 1 : approximate;
}

// ─── Accrual ─────────────────────────────────────────────────────────────────

/**
 * Longest schedule the arithmetic will build: a century of monthly charges.
 * Loan dates are bounded at the API boundary (`boundedDateSchema`), so this
 * only catches rows written before that bound existed or outside the API.
 */
export const MAX_ACCRUAL_MONTHS = 1200;

/**
 * Build the full interest picture as at `asOf`.
 *
 * Repayments dated on or before a month's opening anniversary reduce that
 * month's charge. Paying *on* the anniversary therefore saves the month, which
 * is both the generous reading and the one that matches how the saving is
 * described to a borrower.
 */
export function accrueLoanInterest(input: LoanInterestInput): LoanInterestSchedule {
  const { principal, monthlyRatePercent, loanDate, repayments } = input;

  // Writing a loan off stops the clock. Accruing past that point would inflate
  // a figure nobody intends to collect.
  const asOf =
    input.accrualStoppedOn != null && input.accrualStoppedOn < input.asOf
      ? input.accrualStoppedOn
      : input.asOf;

  const received = [...repayments]
    .filter((entry) => entry.repaymentDate <= asOf)
    .sort((a, b) => (a.repaymentDate < b.repaymentDate ? -1 : a.repaymentDate > b.repaymentDate ? 1 : 0));

  const totalRepaid = round2(received.reduce((sum, entry) => sum + entry.amount, 0));
  const principalPaid = Math.min(totalRepaid, principal);
  const principalOutstanding = round2(principal - principalPaid);
  const interestPaid = round2(Math.max(0, totalRepaid - principal));

  const rate = monthlyRatePercent ?? 0;
  // Clamped as a backstop, not a business rule. Validation bounds loan dates,
  // so a schedule can only exceed a century if the row predates that bound or
  // was written outside the API. Without the clamp one such row blocks the
  // event loop for every other loan in the same request.
  const elapsed = rate > 0 ? Math.min(monthsElapsed(loanDate, asOf), MAX_ACCRUAL_MONTHS) : 0;

  const months: LoanInterestMonth[] = [];
  let accruedInterest = 0;

  for (let index = 1; index <= elapsed; index += 1) {
    const periodStart = addMonthsIso(loanDate, index - 1);
    const chargedOn = addMonthsIso(loanDate, index);

    // Principal still outstanding when the month opened. Only repayments made
    // by then can have reduced it.
    const repaidByStart = received
      .filter((entry) => entry.repaymentDate <= periodStart)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const openingBalance = Math.max(0, round2(principal - Math.min(repaidByStart, principal)));

    // Rounding per month, not only on the total, so a borrower adding up the
    // rows of the schedule reaches the figure printed at the bottom.
    const charge = round2((openingBalance * rate) / 100);
    accruedInterest += charge;

    months.push({
      index,
      periodStart,
      periodEnd: previousDayIso(chargedOn),
      chargedOn,
      openingBalance,
      charge,
    });
  }

  accruedInterest = round2(accruedInterest);
  const interestOutstanding = round2(Math.max(0, accruedInterest - interestPaid));

  return {
    monthsElapsed: elapsed,
    months,
    accruedInterest,
    principalPaid: round2(principalPaid),
    principalOutstanding,
    interestPaid,
    interestOutstanding,
    payoffToday: round2(principalOutstanding + interestOutstanding),
    isSettled: principalOutstanding <= 0 && interestOutstanding <= 0,
  };
}

/**
 * Date the loan was fully cleared — principal *and* accrued interest — or null
 * while anything is still owed.
 *
 * Found by replaying the repayments rather than checking only the latest,
 * because accrual has to stop at settlement: a loan cleared in month 3 must
 * not keep charging while a later, unrelated overpayment sits in the ledger.
 */
export function findLoanSettlementDate(
  input: Omit<LoanInterestInput, "asOf">,
): string | null {
  // Duplicate dates cost one redundant identical check; a dedup pass would
  // cost more to read than it saves on a handful of rows.
  const dates = input.repayments.map((entry) => entry.repaymentDate).sort();
  for (const date of dates) {
    if (accrueLoanInterest({ ...input, asOf: date }).isSettled) return date;
  }
  return null;
}

/**
 * Status implied by the ledger.
 *
 * `fully_repaid` means nothing is owed, interest included — a loan whose
 * principal is clear but whose interest is not has not been repaid, and saying
 * otherwise would make the status lie about the figure next to it.
 *
 * `defaulted` is the one status the ledger cannot infer: it is a judgement that
 * the money is not coming back, so it always wins.
 */
export function deriveLoanStatus(
  schedule: LoanInterestSchedule,
  isDefaulted: boolean,
): LoanStatus {
  if (isDefaulted) return "defaulted";
  if (schedule.isSettled) return "fully_repaid";
  if (schedule.principalPaid > 0 || schedule.interestPaid > 0) return "partially_repaid";
  return "active";
}

// ─── The four figures shown together ─────────────────────────────────────────

export interface LoanInterestViewInput {
  principal: number;
  monthlyRatePercent: number | null;
  loanDate: string;
  expectedPaybackDate: string | null;
  accrualStoppedOn: string | null;
  repayments: readonly LoanRepaymentEntry[];
  /** Today, `YYYY-MM-DD`. */
  today: string;
}

export interface LoanInterestView {
  monthsElapsed: number;
  /** Interest charged so far, or frozen at settlement once it happened. */
  accruedInterest: number;
  interestPaid: number;
  interestOutstanding: number;
  /** Principal plus outstanding interest: what clears the loan right now. */
  payoffToday: number;
  /**
   * Interest if the loan ran to its expected payback date and was repaid in one
   * go — the figure assumed when the term was agreed. Deliberately ignores
   * actual repayments so it stays the promise you are comparing reality
   * against, rather than drifting every time one is recorded.
   */
  expectedInterest: number | null;
  /** Frozen total once the loan is settled; null while anything is owed. */
  finalInterest: number | null;
  settledOn: string | null;
  /** Month-by-month charges, for the schedule shown to the borrower. */
  months: LoanInterestMonth[];
}

/**
 * Every interest figure for one loan, computed together so they cannot disagree.
 *
 * Accrual runs to the settlement date once there is one — a loan cleared in
 * month three must not still be charging in month nine.
 */
export function summariseLoanInterest(input: LoanInterestViewInput): LoanInterestView {
  const base = {
    principal: input.principal,
    monthlyRatePercent: input.monthlyRatePercent,
    loanDate: input.loanDate,
    repayments: input.repayments,
    accrualStoppedOn: input.accrualStoppedOn,
  };

  const settledOn = findLoanSettlementDate(base);
  const current = accrueLoanInterest({ ...base, asOf: settledOn ?? input.today });

  const expectedInterest =
    input.expectedPaybackDate == null
      ? null
      : accrueLoanInterest({ ...base, repayments: [], asOf: input.expectedPaybackDate })
          .accruedInterest;

  return {
    monthsElapsed: current.monthsElapsed,
    accruedInterest: current.accruedInterest,
    interestPaid: current.interestPaid,
    interestOutstanding: current.interestOutstanding,
    payoffToday: current.payoffToday,
    expectedInterest,
    finalInterest: settledOn == null ? null : current.accruedInterest,
    settledOn,
    months: current.months,
  };
}

/** Currency arithmetic accumulates float error; every exported total rounds. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
