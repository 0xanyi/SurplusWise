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

// ─── Per-APR interest buckets ────────────────────────────────────────────────
//
// A statement can carry several APR lines at once (a 0% balance transfer next
// to purchases at 24.9%). Each line is a bucket; when buckets are present they
// are the source of truth and the statement-level interest and basis are their
// sums.

export type InterestBucketType =
  | "purchases"
  | "balance_transfer"
  | "cash_advance"
  | "promotional"
  | "other";

/** Zod needs a mutable tuple; treat it as readonly everywhere else. */
export const INTEREST_BUCKET_TYPES: [InterestBucketType, ...InterestBucketType[]] = [
  "purchases",
  "balance_transfer",
  "cash_advance",
  "promotional",
  "other",
];

export const INTEREST_BUCKET_LABELS: Record<InterestBucketType, string> = {
  purchases: "Purchases",
  balance_transfer: "Balance transfer",
  cash_advance: "Cash advance",
  promotional: "Promotional",
  other: "Other",
};

/** Hard cap so the jsonb column cannot grow without bound. */
export const MAX_INTEREST_BUCKETS = 8;

export interface InterestBucket {
  type: InterestBucketType;
  /** Free-text override of the preset name; null uses the type's label. */
  label?: string | null;
  /** The balance the issuer charged interest against for this line. */
  balanceSubjectToInterest: number;
  interestCharged: number;
  /** Advertised APR for this line, percent. */
  apr?: number | null;
}

/**
 * Statement-level totals implied by a split, or null when there is no split.
 * When buckets exist they are the source of truth: the statement's
 * `interest_charged` and `balance_subject_to_interest` columns are these sums.
 */
export function sumInterestBreakdown(
  buckets: InterestBucket[] | null | undefined,
): { interestCharged: number; balanceSubjectToInterest: number } | null {
  if (!buckets || buckets.length === 0) return null;
  return {
    interestCharged: round2(buckets.reduce((sum, b) => sum + b.interestCharged, 0)),
    balanceSubjectToInterest: round2(
      buckets.reduce((sum, b) => sum + b.balanceSubjectToInterest, 0),
    ),
  };
}

/**
 * Canonical stored form of a breakdown: null when there is no split, otherwise
 * the buckets with labels trimmed and blank labels nulled. Assumes the input
 * has already passed validation (`lib/db/validation.ts`).
 */
export function normaliseInterestBreakdown(
  input: InterestBucket[] | null | undefined,
): InterestBucket[] | null {
  if (!input || input.length === 0) return null;
  return input.map((bucket) => ({
    type: bucket.type,
    label: bucket.label?.trim() ? bucket.label.trim() : null,
    balanceSubjectToInterest: bucket.balanceSubjectToInterest,
    interestCharged: bucket.interestCharged,
    apr: bucket.apr ?? null,
  }));
}

/**
 * The rate one APR line implies, using the line's printed basis so the result
 * is always exact, never a midpoint estimate.
 *
 * Unlike a whole statement, a zero basis is not automatically meaningless: a
 * 0% promotional line with nothing yet subject to interest is a real 0%
 * answer. Zero basis with interest actually charged is nonsense and stays
 * null, as does a broken period.
 */
export function deriveBucketRate(
  bucket: Pick<InterestBucket, "balanceSubjectToInterest" | "interestCharged">,
  periodStart: string,
  periodEnd: string,
): DerivedRate | null {
  const periodDays = getPeriodDays(periodStart, periodEnd);
  if (periodDays <= 0) return null;

  if (!(bucket.balanceSubjectToInterest > 0)) {
    if (bucket.interestCharged === 0) {
      return {
        periodRatePercent: 0,
        annualisedPercent: 0,
        basis: 0,
        estimated: false,
        periodDays,
      };
    }
    return null;
  }

  // A printed basis makes the midpoint inputs irrelevant; deriveRate's own
  // null-on-zero-basis contract is unchanged and still governs statements.
  return deriveRate({
    openingBalance: 0,
    closingBalance: 0,
    interestCharged: bucket.interestCharged,
    balanceSubjectToInterest: bucket.balanceSubjectToInterest,
    periodStart,
    periodEnd,
  });
}

export type RevolvingDebtType = "credit_card" | "overdraft";

/**
 * Whether a debt revolves, and so has a percentage-of-balance minimum at all.
 *
 * Loans and mortgages are amortising: the instalment is fixed by the agreement,
 * not derived from the balance. Applying the card rule to them invents a figure.
 */
export function isRevolvingDebt(debtType: string): debtType is RevolvingDebtType {
  return debtType === "credit_card" || debtType === "overdraft";
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
 *
 * Callers must check `isRevolvingDebt` first. This rule is a credit-card rule;
 * 1% of a mortgage balance is not a mortgage payment.
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

/**
 * First day from which a payment counts towards the *next* amount due.
 *
 * After a statement closes, money paid during that cycle settled the previous
 * statement; only payments dated after the period end reduce what is now owed.
 * With no statement recorded, the debt falls back to a monthly cadence, so the
 * window is the current calendar month.
 */
export function getPaymentWindowStart(
  latestPeriodEnd: string | null,
  reference: Date = new Date(),
): string {
  if (latestPeriodEnd) {
    const dayAfter = new Date(`${latestPeriodEnd}T00:00:00Z`);
    if (!Number.isNaN(dayAfter.getTime())) {
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      return dayAfter.toISOString().slice(0, 10);
    }
  }

  const year = reference.getFullYear();
  const month = `${reference.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
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
