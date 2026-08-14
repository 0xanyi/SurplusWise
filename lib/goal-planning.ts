const DAY_MS = 24 * 60 * 60 * 1000;
const AVERAGE_MONTH_DAYS = 365.25 / 12;

export type GoalFundingStatus = "undated" | "scheduled" | "overdue" | "complete";

export interface GoalFundingPlan {
  fundingStatus: GoalFundingStatus;
  monthsRemaining: number | null;
  monthlyContribution: number | null;
}

export function getGoalFundingPlan(
  targetAmount: number,
  currentAmount: number,
  targetDate: string | null,
  today: string,
): GoalFundingPlan {
  const remaining = Math.max(targetAmount - currentAmount, 0);
  if (remaining === 0) {
    return { fundingStatus: "complete", monthsRemaining: 0, monthlyContribution: 0 };
  }
  if (!targetDate) {
    return { fundingStatus: "undated", monthsRemaining: null, monthlyContribution: null };
  }

  const daysRemaining = Math.floor(
    (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS,
  );
  if (daysRemaining < 0) {
    return { fundingStatus: "overdue", monthsRemaining: 0, monthlyContribution: remaining };
  }

  const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / AVERAGE_MONTH_DAYS));
  const monthlyContribution = Math.ceil((remaining / monthsRemaining) * 100) / 100;

  return { fundingStatus: "scheduled", monthsRemaining, monthlyContribution };
}
