import type { TransactionType } from "@/types";
import { formatCurrency } from "@/lib/utils";

/**
 * One place that maps a money type to how it is drawn, so a dot, a figure and a
 * badge for the same transaction can never disagree — they did, in the recent
 * activity row, where the dot said expense and the amount said neutral.
 *
 * `text`/`bg`/`surface` are the semantic tokens from DESIGN.md. Do not add a
 * fourth "positive" entry: polarity is not a money type.
 */
export const MONEY_TYPE = {
  income: { text: "text-income", bg: "bg-income", surface: "bg-income-surface" },
  expense: { text: "text-expense", bg: "bg-expense", surface: "bg-expense-surface" },
  giving: { text: "text-giving", bg: "bg-giving", surface: "bg-giving-surface" },
} as const satisfies Record<TransactionType, { text: string; bg: string; surface: string }>;

export function moneyTypeTone(type: TransactionType) {
  return MONEY_TYPE[type] ?? MONEY_TYPE.expense;
}

/**
 * Income arrived, expense left, giving did neither — it is its own direction,
 * so it carries no sign. Signing it "+" would file it as an inflow, which is
 * the exact distinction the product exists to make.
 */
export function formatSignedAmount(type: TransactionType, amount: number): string {
  const value = formatCurrency(Math.abs(amount));
  if (type === "income") return `+${value}`;
  if (type === "expense") return `−${value}`;
  return value;
}
