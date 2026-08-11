/**
 * Derivations for debt statements: what rate was actually charged this cycle,
 * what the next minimum payment is likely to be, and whether a statement's
 * figures add up.
 *
 * The honesty constraint that shapes this file: card issuers charge interest on
 * an *average daily balance*, not on the statement's closing balance. When the
 * statement prints that figure (`balanceSubjectToInterest`, mirroring Plaid's
 * `balance_subject_to_apr`) the derived rate is exact. When it doesn't, we
 * estimate from the midpoint of opening and closing and say so — a rate derived
 * from the closing balance alone understates a cycle where the balance grew and
 * overstates one where it shrank.
 */

/** A statement's interest-relevant figures. */
export interface StatementRateInput {
  openingBalance: number;
  closingBalance: number;
  interestCharged: number;
  /** From the statement when printed; null falls back to an estimate. */
  balanceSubjectToInterest?: number | null;
  periodStart: string;
  periodEnd: string;
}

export interface DerivedRate {
  /** Rate charged over this billing period, as a percentage. */
  periodRatePercent: number;
  /** Period rate compounded out to a year, comparable to an advertised APR. */
  annualisedPercent: number;
  /** The balance the rate was calculated against. */
  basis: number;
  /** True when `basis` is a midpoint estimate rather than a printed figure. */
  estimated: boolean;
  /** Length of the billing period in days. */
  periodDays: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Inclusive day count of a billing period. A 1 May – 31 May statement is 31
 * days, not 30: both endpoints are days the balance was carried.
 */
export function getPeriodDays(periodStart: string, periodEnd: string): number {
  const start = Date.parse(`${periodStart}T00:00:00Z`);
  const end = Date.parse(`${periodEnd}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/**
 * Work out the rate a statement's interest charge implies.
 *
 * Returns null when the maths would be meaningless rather than returning a
 * misleading zero: no interest basis, a credit balance, or a broken period.
 * Zero interest on a positive balance is a real answer (paid in full, grace
 * period intact) and returns a 0% rate.
 */
export function deriveRate(input: StatementRateInput): DerivedRate | null {
  const periodDays = getPeriodDays(input.periodStart, input.periodEnd);
  if (periodDays <= 0) return null;

  const printed = input.balanceSubjectToInterest;
  const estimated = printed == null;
  const basis = estimated ? (input.openingBalance + input.closingBalance) / 2 : printed;

  // A zero or credit basis cannot carry interest; any rate derived from it is noise.
  if (!(basis > 0)) return null;
  if (input.interestCharged < 0) return null;

  const periodRate = input.interestCharged / basis;

  // Compound by actual period length so a 28-day and a 31-day cycle at the same
  // daily rate annualise to the same number. This is an EAR, directly
  // comparable to the APR advertised on a UK card.
  const annualised = Math.pow(1 + periodRate, 365 / periodDays) - 1;

  return {
    periodRatePercent: periodRate * 100,
    annualisedPercent: annualised * 100,
    basis,
    estimated,
    periodDays,
  };
}

/**
 * Difference between the advertised APR and what this cycle actually implies,
 * in percentage points. Positive means the cycle cost more than the headline
 * rate — an expired promotional rate, a cash advance, or a fee counted as
 * interest.
 *
 * Both sides are EAR-basis: `interestRate` on a debt is stored as the APR as
 * advertised, and `annualisedPercent` is compounded, never a nominal x12.
 */
export function getRateVariance(
  derived: DerivedRate | null,
  advertisedApr: number | null | undefined,
): number | null {
  if (!derived || advertisedApr == null) return null;
  return derived.annualisedPercent - advertisedApr;
}

export interface MinimumPaymentRule {
  percent?: number | null;
  floor?: number | null;
}

/**
 * Forecast the next minimum payment for a revolving debt.
 *
 * Shape follows FCA CONC 6.7.5R, which requires UK issuers to set the minimum
 * at no less than the interest, fees and charges applied in the period plus 1%
 * of the outstanding balance. Used only when no statement has been recorded
 * yet — a statement's own `minimumPayment` is a fact and always wins.
 */
export function forecastMinimumPayment(
  closingBalance: number,
  interestCharged: number,
  feesCharged: number,
  rule: MinimumPaymentRule,
): number | null {
  if (!(closingBalance > 0)) return null;

  const percent = rule.percent ?? 1;
  const base = interestCharged + feesCharged + (closingBalance * percent) / 100;
  const floored = rule.floor != null ? Math.max(base, rule.floor) : base;

  // Never ask for more than is owed.
  return Math.min(floored, closingBalance);
}

export interface ResidualInput {
  openingBalance: number;
  closingBalance: number;
  interestCharged: number;
  feesCharged: number;
  newSpending?: number | null;
  paymentsInPeriod: number;
}

/**
 * How much of the closing balance the recorded figures fail to explain.
 *
 * opening + spending + interest + fees - payments = closing, on every real
 * statement. A non-zero residual usually means a refund, cashback, or a fee the
 * user did not itemise — all normal. This is reported, never enforced: blocking
 * a save over a £3 gap costs more record than it protects.
 */
export function getStatementResidual(input: ResidualInput): number {
  const expected =
    input.openingBalance +
    (input.newSpending ?? 0) +
    input.interestCharged +
    input.feesCharged -
    input.paymentsInPeriod;
  return round2(input.closingBalance - expected);
}

/** Residual large enough to be worth mentioning: over £1, or over 0.5% of the balance. */
export function isResidualSignificant(residual: number, closingBalance: number): boolean {
  const magnitude = Math.abs(residual);
  if (magnitude === 0) return false;
  const relativeThreshold = Math.abs(closingBalance) * 0.005;
  return magnitude > Math.max(1, relativeThreshold);
}

/** Credit utilisation as a percentage, or null when there is no limit to measure against. */
export function getUtilisation(
  balance: number,
  creditLimit: number | null | undefined,
): number | null {
  if (creditLimit == null || !(creditLimit > 0)) return null;
  return (balance / creditLimit) * 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
