/**
 * Recovery arithmetic for costs carried on someone else's behalf.
 *
 * ## The stance
 *
 * A recovered cost is still an expense, and its recovery is still income. Sika
 * never nets them in the ledger: totals, budgets and CSV export see both sides
 * in full. Netting happens only in the client view and in the overhead split on
 * Reports. This is the same discipline as the debt-interest rule in
 * `lib/db/analytics.ts` §4 — do not "simplify" it by subtracting a recovery
 * from an expense total.
 *
 * ## Why recovery accrues on payment, not on schedule
 *
 * A client owes you for a cost once you have actually paid it. A domain that
 * renews in November is not owed in August, so expected recovery accumulates
 * over payment logs rather than over scheduled cycles. That also makes the
 * figure immune to a bill whose amount moved between cycles: what you paid is
 * what you are owed.
 */

export type RebillMode = "none" | "at_cost" | "fixed" | "bundled";

export const REBILL_MODES: readonly RebillMode[] = [
  "none",
  "at_cost",
  "fixed",
  "bundled",
] as const;

/** Modes that expect money back on a line of their own. */
const RECOVERABLE_MODES: readonly RebillMode[] = ["at_cost", "fixed"] as const;

/**
 * True when this mode expects a separate recovery.
 *
 * `bundled` is deliberately excluded: a retainer already covers it, so counting
 * it again would report a leak that does not exist.
 */
export function expectsRecovery(mode: RebillMode): boolean {
  return RECOVERABLE_MODES.includes(mode);
}

/** True when the cost belongs to someone else, whatever the recovery terms. */
export function isPassThrough(mode: RebillMode): boolean {
  return mode !== "none";
}

export interface RebillShape {
  rebillMode: RebillMode;
  clientId: string | null;
  rebillAmount: number | null;
}

/**
 * A rebill combination that cannot mean anything.
 *
 * Its own class rather than a plain Error so the API layer can answer 400 by
 * type instead of sniffing the message for a substring — the message is written
 * for the user and is free to change.
 */
export class RebillShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RebillShapeError";
  }
}

/**
 * The invariants the database CHECK constraints also enforce, checked in the
 * service layer so the user gets a sentence rather than a constraint name.
 *
 * Kept in both places on purpose: the CHECKs are the backstop against a bad
 * write from anywhere, and these are the message.
 */
export function assertRebillShape(shape: RebillShape): void {
  if (shape.rebillMode !== "none" && !shape.clientId) {
    throw new RebillShapeError(
      "A rebilled cost needs a client — choose one, or set it back to your own overhead",
    );
  }
  if (shape.rebillMode === "fixed" && shape.rebillAmount == null) {
    throw new RebillShapeError("A fixed rebill needs the amount you charge for it");
  }
}

/**
 * A rebill amount only means something on a `fixed` line, so it is dropped
 * everywhere else rather than rejected.
 *
 * Silently correcting rather than erroring is the house style — the same choice
 * the debt statements make when a client's interest total disagrees with its own
 * APR lines. It keeps a mode change from failing on a value the form had no
 * reason to clear.
 */
export function normaliseRebillAmount(
  mode: RebillMode,
  rebillAmount: number | null | undefined,
): number | null {
  if (mode !== "fixed") return null;
  return rebillAmount ?? null;
}

/**
 * What one payment of this cost is expected to bring back.
 *
 * `at_cost` uses the amount actually paid rather than the scheduled amount, so
 * a bill that went up recovers what it really cost.
 */
export function expectedRecoveryForPayment(
  mode: RebillMode,
  amountPaid: number,
  rebillAmount: number | null,
): number {
  if (mode === "at_cost") return amountPaid;
  if (mode === "fixed") return rebillAmount ?? 0;
  return 0;
}

/** One cost fronted for a client, already reduced to what the rollup needs. */
export interface FrontedPayment {
  amountPaid: number;
  rebillMode: RebillMode;
  rebillAmount: number | null;
}

export interface ClientRollupInput {
  /** Payments logged against this client's recurring outgoings. */
  payments: readonly FrontedPayment[];
  /**
   * Expense transactions tagged to this client. They eat margin but expect no
   * recovery: nothing about a plain transaction says it should be rebilled.
   * Model a recoverable one-off as an outgoing so it can carry a mode.
   */
  taggedExpenses: readonly number[];
  /** Income transactions tagged to this client. */
  taggedIncome: readonly number[];
}

export interface ClientRollup {
  /** Everything paid out on this client's behalf. */
  fronted: number;
  /** Everything received from them. */
  received: number;
  /** What the fronted costs were supposed to bring back. */
  expectedRecovery: number;
  /**
   * The shortfall, floored at zero. Cumulative rather than per-month so a
   * November renewal settled in December never reads as a leak that later
   * heals itself — only a persistent gap shows.
   */
  notYetRecovered: number;
  /** Received minus fronted. Negative means this client is costing you money. */
  margin: number;
}

export function rollUpClient(input: ClientRollupInput): ClientRollup {
  let fronted = 0;
  let expectedRecovery = 0;

  for (const payment of input.payments) {
    fronted += payment.amountPaid;
    expectedRecovery += expectedRecoveryForPayment(
      payment.rebillMode,
      payment.amountPaid,
      payment.rebillAmount,
    );
  }

  for (const amount of input.taggedExpenses) {
    fronted += amount;
  }

  let received = 0;
  for (const amount of input.taggedIncome) {
    received += amount;
  }

  return {
    fronted: round2(fronted),
    received: round2(received),
    expectedRecovery: round2(expectedRecovery),
    notYetRecovered: round2(Math.max(0, expectedRecovery - received)),
    margin: round2(received - fronted),
  };
}

export interface RollupTotals {
  fronted: number;
  received: number;
  notYetRecovered: number;
  monthlyFronted: number;
}

/**
 * Add up rollups that have already been computed per client.
 *
 * Summing the rows rather than re-querying is what keeps a header figure from
 * disagreeing with the list beneath it. Note `notYetRecovered` is summed after
 * each client's own floor, so a client who has overpaid does not cancel out
 * another client's genuine shortfall.
 */
export function sumRollups(
  rows: readonly (ClientRollup & { monthlyFronted?: number })[],
): RollupTotals {
  let fronted = 0;
  let received = 0;
  let notYetRecovered = 0;
  let monthlyFronted = 0;

  for (const row of rows) {
    fronted += row.fronted;
    received += row.received;
    notYetRecovered += row.notYetRecovered;
    monthlyFronted += row.monthlyFronted ?? 0;
  }

  return {
    fronted: round2(fronted),
    received: round2(received),
    notYetRecovered: round2(notYetRecovered),
    monthlyFronted: round2(monthlyFronted),
  };
}

export interface WorkspaceCostSplit {
  /** Costs nobody else pays for — the true price of running the workspace. */
  overhead: number;
  /** Costs fronted for someone, whatever the recovery terms. */
  passThrough: number;
  /** Money received from clients. */
  recovered: number;
  /**
   * What the workspace actually costs to run: its own overhead plus whatever
   * of the pass-through never came back. Never negative — a client who has
   * overpaid does not make your overhead cheaper.
   */
  netCost: number;
}

export function splitWorkspaceCosts(input: {
  overhead: number;
  passThrough: number;
  recovered: number;
}): WorkspaceCostSplit {
  const unrecovered = Math.max(0, input.passThrough - input.recovered);
  return {
    overhead: round2(input.overhead),
    passThrough: round2(input.passThrough),
    recovered: round2(input.recovered),
    netCost: round2(input.overhead + unrecovered),
  };
}

/** Currency arithmetic accumulates float error; every exported total rounds. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
