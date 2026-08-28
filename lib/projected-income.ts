/**
 * Planning totals for income budgets. Received money is compared with the
 * projection; going past the figure is ahead of plan, not over budget.
 */

export function summarizeProjectedIncome(
  rows: Array<{ amount: number; spent: number }>,
) {
  let expected = 0;
  let received = 0;
  for (const row of rows) {
    expected += row.amount;
    received += row.spent;
  }
  return {
    expected,
    received,
    outstanding: expected - received,
  };
}

export function incomeProjectionCopy(
  outstanding: number,
  formatAmount: (amount: number) => string,
) {
  if (outstanding > 0) return `${formatAmount(outstanding)} still expected`;
  if (outstanding < 0) {
    return `${formatAmount(Math.abs(outstanding))} ahead of projection`;
  }
  return "On projection";
}
