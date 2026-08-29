export interface NetPositionTotals {
  totalIncome: number;
  totalExpenses: number;
  totalGivings: number;
  netBalance: number;
}

export type NetPositionBarMode = "income-share" | "outflow-share" | "empty";

export interface NetPositionSplit {
  surplus: boolean;
  hasIncome: boolean;
  spentPct: number;
  givenPct: number;
  keptPct: number;
  spentWidth: number;
  givenWidth: number;
  keptWidth: number;
  barMode: NetPositionBarMode;
}

/**
 * Shares of money that came in. With no income there is nothing to apportion,
 * so the bar either collapses or (when money still left) splits the outflow.
 */
export function netPositionSplit(totals: NetPositionTotals): NetPositionSplit {
  const { totalIncome, totalExpenses, totalGivings, netBalance } = totals;
  const surplus = netBalance >= 0;
  const hasIncome = totalIncome > 0;
  const pct = (n: number) => (hasIncome ? Math.max(0, (n / totalIncome) * 100) : 0);

  const spentPct = pct(totalExpenses);
  const givenPct = pct(totalGivings);
  const keptPct = hasIncome ? Math.max(0, 100 - spentPct - givenPct) : 0;

  const drawnTotal = Math.max(spentPct + givenPct, 100);
  const spentWidth = hasIncome ? (spentPct / drawnTotal) * 100 : 0;
  const givenWidth = hasIncome ? (givenPct / drawnTotal) * 100 : 0;
  const keptWidth = hasIncome ? Math.max(0, 100 - spentWidth - givenWidth) : 0;

  if (!hasIncome) {
    const outflow = totalExpenses + totalGivings;
    if (outflow <= 0) {
      return {
        surplus,
        hasIncome,
        spentPct: 0,
        givenPct: 0,
        keptPct: 0,
        spentWidth: 0,
        givenWidth: 0,
        keptWidth: 0,
        barMode: "empty",
      };
    }
    return {
      surplus,
      hasIncome,
      spentPct: 0,
      givenPct: 0,
      keptPct: 0,
      spentWidth: (totalExpenses / outflow) * 100,
      givenWidth: (totalGivings / outflow) * 100,
      keptWidth: 0,
      barMode: "outflow-share",
    };
  }

  return {
    surplus,
    hasIncome,
    spentPct,
    givenPct,
    keptPct,
    spentWidth,
    givenWidth,
    keptWidth,
    barMode: "income-share",
  };
}

export function netPositionSentence(
  totals: NetPositionTotals,
  formatAmount: (n: number) => string,
): string {
  const split = netPositionSplit(totals);
  if (!split.hasIncome) {
    if (totals.totalExpenses === 0 && totals.totalGivings === 0) {
      return "No money moved in this window";
    }
    if (!split.surplus) {
      return `${formatAmount(Math.abs(totals.netBalance))} more went out than came in`;
    }
    return "Surplus · no income in this window";
  }
  const kept = Math.round(split.keptPct);
  return split.surplus
    ? `Surplus · you kept ${kept}% of what came in`
    : `Deficit · you kept ${kept}% of what came in`;
}

/**
 * A loss must read as a loss at figure scale. `formatCurrency(Math.abs(n))`
 * alone is how a deficit rendered as a surplus; the minus is the signal.
 * Unicode minus matches `formatSignedAmount`, not ASCII hyphen.
 */
export function netPositionFigure(
  netBalance: number,
  formatAmount: (n: number) => string,
): string {
  if (netBalance < 0) return `−${formatAmount(Math.abs(netBalance))}`;
  return formatAmount(netBalance);
}
