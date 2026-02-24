/**
 * Pure helper functions extracted from service modules for testability.
 *
 * These contain zero DB / IO dependencies.
 */

import type { DefaultCategory, TransactionType } from "./default-categories";

// ─── Analytics date range helpers ────────────────────────────────────────────

export type Period =
  | "week"
  | "weekly"
  | "month"
  | "monthly"
  | "quarter"
  | "quarterly"
  | "year"
  | "yearly"
  | "custom";

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Resolve a named period to a concrete date range.
 * For "custom", startDate/endDate must be supplied by the caller.
 */
export function getDateRange(
  period: Period,
  custom?: Partial<DateRange>,
): DateRange {
  if (period === "custom" && custom?.startDate && custom?.endDate) {
    return { startDate: custom.startDate, endDate: custom.endDate };
  }

  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  let start: Date;

  switch (period) {
    case "week":
    case "weekly":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case "quarter":
    case "quarterly":
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      break;
    case "year":
    case "yearly":
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "month":
    case "monthly":
    default:
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
  }

  return { startDate: start.toISOString().split("T")[0], endDate };
}

// ─── Budget usage math ──────────────────────────────────────────────────────

export interface BudgetUsage {
  spent: number;
  remaining: number;
  percentUsed: number;
}

/**
 * Given a budget's total amount and how much has been spent,
 * return the remaining amount and percentage used.
 *
 * - `remaining` can be negative (over-budget).
 * - `percentUsed` is 0 when budgetAmount is 0 (avoid division by zero).
 */
export function computeBudgetUsage(
  budgetAmount: number,
  spent: number,
): BudgetUsage {
  const remaining = budgetAmount - spent;
  const percentUsed =
    budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
  return { spent, remaining, percentUsed };
}

// ─── Default-category diff ──────────────────────────────────────────────────

export interface CategoryDiff {
  /** Categories that need to be inserted (not yet present). */
  missing: DefaultCategory[];
}

/**
 * Compare a list of existing category names against a set of defaults
 * and return the ones that are missing. Case-insensitive comparison.
 */
export function getMissingDefaults(
  existingNames: string[],
  defaults: DefaultCategory[],
): CategoryDiff {
  const existing = new Set(existingNames.map((n) => n.toLowerCase()));
  const missing = defaults.filter(
    (cat) => !existing.has(cat.name.toLowerCase()),
  );
  return { missing };
}

/**
 * Convenience: run `getMissingDefaults` for every transaction type at once.
 */
export function getMissingDefaultsByType(
  existingByType: Record<TransactionType, string[]>,
  allDefaults: Record<TransactionType, DefaultCategory[]>,
): Record<TransactionType, CategoryDiff> {
  const types: TransactionType[] = ["expense", "giving", "income"];
  const result = {} as Record<TransactionType, CategoryDiff>;
  for (const t of types) {
    result[t] = getMissingDefaults(
      existingByType[t] ?? [],
      allDefaults[t] ?? [],
    );
  }
  return result;
}
