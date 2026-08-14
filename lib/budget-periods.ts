export type BudgetPeriod = "monthly" | "quarterly" | "yearly";

interface BudgetRange {
  startDate: string;
  endDate: string;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function endOfPeriod(start: Date, period: BudgetPeriod) {
  const months = period === "monthly" ? 1 : period === "quarterly" ? 3 : 12;
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 0));
}

export function getCurrentBudgetRange(period: BudgetPeriod, now = new Date()): BudgetRange {
  const month =
    period === "yearly"
      ? 0
      : period === "quarterly"
        ? Math.floor(now.getMonth() / 3) * 3
        : now.getMonth();
  const start = new Date(Date.UTC(now.getFullYear(), month, 1));

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(endOfPeriod(start, period)),
  };
}

export function getNextBudgetRange(endDate: string, period: BudgetPeriod): BudgetRange {
  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(endOfPeriod(start, period)),
  };
}

export function getRolledBudgetAmount(amount: number, remaining: number) {
  return Math.round((amount + Math.max(remaining, 0)) * 100) / 100;
}
