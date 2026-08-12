import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RebillShapeError,
  assertRebillShape,
  expectedRecoveryForPayment,
  expectsRecovery,
  isPassThrough,
  normaliseRebillAmount,
  rollUpClient,
  splitWorkspaceCosts,
  sumRollups,
  type FrontedPayment,
} from "./rebill";

// ─── Mode semantics ──────────────────────────────────────────────────────────

test("bundled is a pass-through that expects no separate recovery", () => {
  // The distinction the whole feature turns on: a retainer already covers a
  // bundled cost, so counting it as recoverable would invent a leak.
  assert.equal(isPassThrough("bundled"), true);
  assert.equal(expectsRecovery("bundled"), false);

  assert.equal(isPassThrough("at_cost"), true);
  assert.equal(expectsRecovery("at_cost"), true);

  assert.equal(isPassThrough("none"), false);
  assert.equal(expectsRecovery("none"), false);
});

// ─── Shape invariants ────────────────────────────────────────────────────────

test("a rebill mode without a client is rejected", () => {
  assert.throws(
    () => assertRebillShape({ rebillMode: "at_cost", clientId: null, rebillAmount: null }),
    RebillShapeError,
  );
});

test("a fixed rebill without an amount is rejected", () => {
  assert.throws(
    () => assertRebillShape({ rebillMode: "fixed", clientId: "c1", rebillAmount: null }),
    RebillShapeError,
  );
});

test("own overhead needs no client", () => {
  assert.doesNotThrow(() =>
    assertRebillShape({ rebillMode: "none", clientId: null, rebillAmount: null }),
  );
});

test("a rebill amount is dropped on every mode but fixed", () => {
  // A mode change must not fail on a value the form had no reason to clear.
  assert.equal(normaliseRebillAmount("at_cost", 60), null);
  assert.equal(normaliseRebillAmount("bundled", 60), null);
  assert.equal(normaliseRebillAmount("none", 60), null);
  assert.equal(normaliseRebillAmount("fixed", 60), 60);
  assert.equal(normaliseRebillAmount("fixed", undefined), null);
});

// ─── Expected recovery ───────────────────────────────────────────────────────

test("at_cost recovers what was actually paid, not what was scheduled", () => {
  // A hosting bill that went up recovers the higher figure without anyone
  // having to remember to edit the schedule.
  assert.equal(expectedRecoveryForPayment("at_cost", 47.5, null), 47.5);
});

test("fixed recovers its own price regardless of what the cost was", () => {
  assert.equal(expectedRecoveryForPayment("fixed", 40, 60), 60);
});

test("bundled and own overhead recover nothing on a line of their own", () => {
  assert.equal(expectedRecoveryForPayment("bundled", 40, null), 0);
  assert.equal(expectedRecoveryForPayment("none", 40, null), 0);
});

// ─── Client rollup ───────────────────────────────────────────────────────────

const payment = (
  amountPaid: number,
  rebillMode: FrontedPayment["rebillMode"],
  rebillAmount: number | null = null,
): FrontedPayment => ({ amountPaid, rebillMode, rebillAmount });

test("a marked-up domain shows the markup as margin", () => {
  const rollup = rollUpClient({
    payments: [payment(40, "fixed", 60)],
    taggedExpenses: [],
    taggedIncome: [60],
  });

  assert.equal(rollup.fronted, 40);
  assert.equal(rollup.received, 60);
  assert.equal(rollup.expectedRecovery, 60);
  assert.equal(rollup.notYetRecovered, 0);
  assert.equal(rollup.margin, 20);
});

test("a cost paid but not yet billed reads as not yet recovered", () => {
  const rollup = rollUpClient({
    payments: [payment(40, "at_cost")],
    taggedExpenses: [],
    taggedIncome: [],
  });

  assert.equal(rollup.notYetRecovered, 40);
  assert.equal(rollup.margin, -40);
});

test("a bundled cost never reads as a leak", () => {
  // The retainer covers it, so there is nothing outstanding even though money
  // went out and none came back against that line.
  const rollup = rollUpClient({
    payments: [payment(40, "bundled")],
    taggedExpenses: [],
    taggedIncome: [],
  });

  assert.equal(rollup.fronted, 40, "it still eats margin");
  assert.equal(rollup.expectedRecovery, 0);
  assert.equal(rollup.notYetRecovered, 0);
  // Nothing is outstanding and yet the client is down £40. Any view that picks
  // its wording from `notYetRecovered` alone will call this a credit.
  assert.equal(rollup.margin, -40);
});

test("an annual renewal settled a month late leaves no residue", () => {
  // The reason recovery is cumulative rather than per-month: a November domain
  // paid back in December must not read as a permanent leak.
  const rollup = rollUpClient({
    payments: [payment(40, "at_cost")],
    taggedExpenses: [],
    taggedIncome: [40],
  });

  assert.equal(rollup.notYetRecovered, 0);
  assert.equal(rollup.margin, 0);
});

test("overpayment never turns into negative outstanding", () => {
  const rollup = rollUpClient({
    payments: [payment(40, "at_cost")],
    taggedExpenses: [],
    taggedIncome: [100],
  });

  assert.equal(rollup.notYetRecovered, 0, "floored at zero");
  assert.equal(rollup.margin, 60);
});

test("a tagged expense eats margin but expects nothing back", () => {
  // Nothing about a plain transaction says it should be rebilled, so it must
  // not silently inflate what the client is held to owe.
  const rollup = rollUpClient({
    payments: [],
    taggedExpenses: [250],
    taggedIncome: [1000],
  });

  assert.equal(rollup.fronted, 250);
  assert.equal(rollup.expectedRecovery, 0);
  assert.equal(rollup.notYetRecovered, 0);
  assert.equal(rollup.margin, 750);
});

test("a retainer against bundled and marked-up costs nets out correctly", () => {
  // The realistic case: monthly retainer, hosting bundled into it, a domain
  // rebilled with a markup, plus a one-off licence bought for them.
  const rollup = rollUpClient({
    payments: [payment(40, "bundled"), payment(12, "fixed", 20)],
    taggedExpenses: [99],
    taggedIncome: [450, 20],
  });

  assert.equal(rollup.fronted, 151);
  assert.equal(rollup.received, 470);
  assert.equal(rollup.expectedRecovery, 20, "only the marked-up domain is owed separately");
  assert.equal(rollup.notYetRecovered, 0);
  assert.equal(rollup.margin, 319);
});

test("totals round rather than accumulating float error", () => {
  const rollup = rollUpClient({
    payments: [payment(0.1, "at_cost"), payment(0.2, "at_cost")],
    taggedExpenses: [],
    taggedIncome: [],
  });

  assert.equal(rollup.fronted, 0.3);
  assert.equal(rollup.expectedRecovery, 0.3);
});

// ─── Totals across clients ───────────────────────────────────────────────────

test("an overpaying client does not cancel another's genuine shortfall", () => {
  // Each client's notYetRecovered is floored before summing, so credit on one
  // account cannot hide a real gap on another.
  const owing = rollUpClient({
    payments: [payment(300, "at_cost")],
    taggedExpenses: [],
    taggedIncome: [],
  });
  const paidUp = rollUpClient({
    payments: [payment(50, "at_cost")],
    taggedExpenses: [],
    taggedIncome: [500],
  });

  const totals = sumRollups([owing, paidUp]);

  assert.equal(totals.notYetRecovered, 300);
  assert.equal(totals.fronted, 350);
  assert.equal(totals.received, 500);
});

test("summing empty rollups gives zeroes, not NaN", () => {
  const totals = sumRollups([]);

  assert.equal(totals.fronted, 0);
  assert.equal(totals.received, 0);
  assert.equal(totals.notYetRecovered, 0);
  assert.equal(totals.monthlyFronted, 0);
});

test("monthly commitment totals when rows carry it", () => {
  const base = rollUpClient({ payments: [], taggedExpenses: [], taggedIncome: [] });

  const totals = sumRollups([
    { ...base, monthlyFronted: 10.1 },
    { ...base, monthlyFronted: 20.2 },
  ]);

  assert.equal(totals.monthlyFronted, 30.3);
});

// ─── Workspace split ─────────────────────────────────────────────────────────

test("net cost is overhead plus whatever never came back", () => {
  const split = splitWorkspaceCosts({ overhead: 200, passThrough: 500, recovered: 300 });

  assert.equal(split.netCost, 400, "200 own + 200 unrecovered");
  assert.equal(split.passThrough, 500, "the gross figure is never netted away");
});

test("an overpaying client does not make overhead look cheaper", () => {
  const split = splitWorkspaceCosts({ overhead: 200, passThrough: 100, recovered: 500 });

  assert.equal(split.netCost, 200);
});

test("the ledger keeps both sides in full", () => {
  // The stance this feature is built on: recovery is income and the cost is an
  // expense. Anything that returns a single netted figure has broken it.
  const split = splitWorkspaceCosts({ overhead: 0, passThrough: 40, recovered: 40 });

  assert.equal(split.passThrough, 40);
  assert.equal(split.recovered, 40);
  assert.equal(split.netCost, 0);
});
