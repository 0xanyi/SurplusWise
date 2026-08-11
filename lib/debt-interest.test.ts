import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveRate,
  forecastMinimumPayment,
  getPeriodDays,
  getRateVariance,
  getStatementResidual,
  getUtilisation,
  isResidualSignificant,
} from "./debt-interest";

// ─── getPeriodDays ───────────────────────────────────────────────────────────

describe("getPeriodDays", () => {
  it("counts both endpoints of the period", () => {
    assert.strictEqual(getPeriodDays("2026-05-01", "2026-05-31"), 31);
    assert.strictEqual(getPeriodDays("2026-02-01", "2026-02-28"), 28);
  });

  it("handles a single-day period", () => {
    assert.strictEqual(getPeriodDays("2026-05-01", "2026-05-01"), 1);
  });

  it("crosses month and year boundaries", () => {
    assert.strictEqual(getPeriodDays("2026-12-15", "2027-01-14"), 31);
  });

  it("is unaffected by daylight saving transitions", () => {
    // BST starts 29 March 2026; a naive local-time diff would give 30.958 days.
    assert.strictEqual(getPeriodDays("2026-03-15", "2026-04-14"), 31);
  });

  it("returns 0 for unparseable dates", () => {
    assert.strictEqual(getPeriodDays("nonsense", "2026-05-31"), 0);
  });
});

// ─── deriveRate ──────────────────────────────────────────────────────────────

describe("deriveRate", () => {
  it("uses the printed balance subject to interest when available", () => {
    const rate = deriveRate({
      openingBalance: 1000,
      closingBalance: 2000,
      interestCharged: 20,
      balanceSubjectToInterest: 1600,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    });
    assert.ok(rate);
    assert.strictEqual(rate.estimated, false);
    assert.strictEqual(rate.basis, 1600);
    assert.ok(Math.abs(rate.periodRatePercent - 1.25) < 1e-9);
  });

  it("estimates from the opening/closing midpoint when not printed", () => {
    const rate = deriveRate({
      openingBalance: 1000,
      closingBalance: 2000,
      interestCharged: 20,
      balanceSubjectToInterest: null,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    });
    assert.ok(rate);
    assert.strictEqual(rate.estimated, true);
    assert.strictEqual(rate.basis, 1500);
  });

  it("annualises by compounding, not by multiplying by 12", () => {
    const rate = deriveRate({
      openingBalance: 1000,
      closingBalance: 1000,
      interestCharged: 15,
      balanceSubjectToInterest: 1000,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    });
    assert.ok(rate);
    // 1.5% over 31 days compounds to ~19.4% EAR, well above the 18% nominal.
    assert.ok(Math.abs(rate.periodRatePercent - 1.5) < 1e-9);
    assert.ok(rate.annualisedPercent > 19);
    assert.ok(rate.annualisedPercent < 20);
    assert.ok(rate.annualisedPercent > 1.5 * 12);
  });

  it("gives the same annualised rate for equal daily rates on different cycle lengths", () => {
    const base = { balanceSubjectToInterest: 1000, openingBalance: 1000, closingBalance: 1000 };
    // Same daily rate, 28-day vs 31-day cycle.
    const short = deriveRate({
      ...base,
      interestCharged: 28,
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
    });
    const long = deriveRate({
      ...base,
      interestCharged: 31,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    });
    assert.ok(short && long);
    // Compounding by period length brings them within a tenth of a point; the
    // small residual gap is real (more frequent compounding earns slightly more).
    assert.ok(Math.abs(short.annualisedPercent - long.annualisedPercent) < 0.1);

    // Without that normalisation the same daily rate would look 3+ points apart,
    // which is the mistake this function exists to avoid.
    const naiveShort = short.periodRatePercent * 12;
    const naiveLong = long.periodRatePercent * 12;
    assert.ok(Math.abs(naiveShort - naiveLong) > 3);
  });

  it("returns a real 0% for a statement paid in full within the grace period", () => {
    const rate = deriveRate({
      openingBalance: 800,
      closingBalance: 900,
      interestCharged: 0,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    });
    assert.ok(rate);
    assert.strictEqual(rate.periodRatePercent, 0);
    assert.strictEqual(rate.annualisedPercent, 0);
  });

  it("returns null rather than a misleading number when the basis is zero", () => {
    assert.strictEqual(
      deriveRate({
        openingBalance: 0,
        closingBalance: 0,
        interestCharged: 0,
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
      }),
      null,
    );
  });

  it("returns null for a credit balance", () => {
    assert.strictEqual(
      deriveRate({
        openingBalance: -50,
        closingBalance: -30,
        interestCharged: 0,
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
      }),
      null,
    );
  });

  it("returns null for a broken period", () => {
    assert.strictEqual(
      deriveRate({
        openingBalance: 1000,
        closingBalance: 1000,
        interestCharged: 15,
        periodStart: "bad",
        periodEnd: "2026-05-31",
      }),
      null,
    );
  });
});

// ─── getRateVariance ─────────────────────────────────────────────────────────

describe("getRateVariance", () => {
  const derived = deriveRate({
    openingBalance: 1000,
    closingBalance: 1000,
    interestCharged: 15,
    balanceSubjectToInterest: 1000,
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
  });

  it("is positive when the cycle cost more than the advertised rate", () => {
    const variance = getRateVariance(derived, 18);
    assert.ok(variance !== null);
    assert.ok(variance > 0);
  });

  it("is negative when a promotional rate is still running", () => {
    const variance = getRateVariance(derived, 24.9);
    assert.ok(variance !== null);
    assert.ok(variance < 0);
  });

  it("returns null when there is no advertised rate on file", () => {
    assert.strictEqual(getRateVariance(derived, null), null);
    assert.strictEqual(getRateVariance(null, 18), null);
  });
});

// ─── forecastMinimumPayment ──────────────────────────────────────────────────

describe("forecastMinimumPayment", () => {
  it("follows the CONC shape: interest + fees + percent of balance", () => {
    // 1% of 2000 = 20, plus 25 interest and 12 fees.
    assert.strictEqual(forecastMinimumPayment(2000, 25, 12, { percent: 1 }), 57);
  });

  it("applies the floor when the computed amount is below it", () => {
    assert.strictEqual(forecastMinimumPayment(200, 2, 0, { percent: 1, floor: 25 }), 25);
  });

  it("ignores the floor when it is not set", () => {
    assert.strictEqual(forecastMinimumPayment(200, 2, 0, { percent: 1 }), 4);
  });

  it("defaults to 1% when no percent is configured", () => {
    assert.strictEqual(forecastMinimumPayment(1000, 0, 0, {}), 10);
  });

  it("never asks for more than the balance", () => {
    assert.strictEqual(forecastMinimumPayment(10, 0, 0, { percent: 1, floor: 25 }), 10);
  });

  it("returns null when nothing is owed", () => {
    assert.strictEqual(forecastMinimumPayment(0, 0, 0, { percent: 1 }), null);
  });
});

// ─── getStatementResidual ────────────────────────────────────────────────────

describe("getStatementResidual", () => {
  it("is zero when the statement balances", () => {
    const residual = getStatementResidual({
      openingBalance: 1000,
      closingBalance: 1115,
      interestCharged: 15,
      feesCharged: 0,
      newSpending: 300,
      paymentsInPeriod: 200,
    });
    assert.strictEqual(residual, 0);
  });

  it("is negative when an unrecorded refund landed", () => {
    const residual = getStatementResidual({
      openingBalance: 1000,
      closingBalance: 1100,
      interestCharged: 15,
      feesCharged: 0,
      newSpending: 300,
      paymentsInPeriod: 200,
    });
    assert.strictEqual(residual, -15);
  });

  it("treats missing spending as zero", () => {
    const residual = getStatementResidual({
      openingBalance: 1000,
      closingBalance: 850,
      interestCharged: 0,
      feesCharged: 0,
      newSpending: null,
      paymentsInPeriod: 150,
    });
    assert.strictEqual(residual, 0);
  });

  it("rounds to whole pence", () => {
    const residual = getStatementResidual({
      openingBalance: 0.1,
      closingBalance: 0.3,
      interestCharged: 0.1,
      feesCharged: 0,
      newSpending: 0,
      paymentsInPeriod: 0,
    });
    assert.strictEqual(residual, 0.1);
  });
});

// ─── isResidualSignificant ───────────────────────────────────────────────────

describe("isResidualSignificant", () => {
  it("ignores an exact match", () => {
    assert.strictEqual(isResidualSignificant(0, 1000), false);
  });

  it("ignores small change", () => {
    assert.strictEqual(isResidualSignificant(0.75, 1000), false);
  });

  it("flags anything over a pound on a small balance", () => {
    assert.strictEqual(isResidualSignificant(3.4, 100), true);
  });

  it("scales with the balance so large statements are not noisy", () => {
    // 0.5% of 10000 = 50.
    assert.strictEqual(isResidualSignificant(40, 10_000), false);
    assert.strictEqual(isResidualSignificant(60, 10_000), true);
  });

  it("flags negative residuals too", () => {
    assert.strictEqual(isResidualSignificant(-30, 100), true);
  });
});

// ─── getUtilisation ──────────────────────────────────────────────────────────

describe("getUtilisation", () => {
  it("returns a percentage of the limit", () => {
    assert.strictEqual(getUtilisation(500, 2000), 25);
  });

  it("returns null without a limit", () => {
    assert.strictEqual(getUtilisation(500, null), null);
    assert.strictEqual(getUtilisation(500, 0), null);
  });

  it("reports over-limit balances above 100", () => {
    assert.ok((getUtilisation(2500, 2000) ?? 0) > 100);
  });
});
