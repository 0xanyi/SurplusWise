import { getDateRange } from "@/lib/db/helpers";
import type { DateRange } from "@/lib/db/helpers";

export type DashboardPeriod = "week" | "month" | "quarter" | "year";

export const DASHBOARD_PERIOD_OPTIONS: {
  value: DashboardPeriod;
  short: string;
  label: string;
}[] = [
  { value: "week", short: "7D", label: "Last 7 days" },
  { value: "month", short: "30D", label: "Last 30 days" },
  { value: "quarter", short: "3M", label: "Last 3 months" },
  { value: "year", short: "1Y", label: "Last 12 months" },
];

export function isDashboardPeriod(value: string | null | undefined): value is DashboardPeriod {
  return value === "week" || value === "month" || value === "quarter" || value === "year";
}

export function parseDashboardPeriod(value: string | null | undefined): DashboardPeriod {
  return isDashboardPeriod(value) ? value : "month";
}

/** Budgets are monthly / quarterly / yearly. A 7-day window still uses monthly allocations. */
export function budgetApiPeriod(
  period: DashboardPeriod,
): "monthly" | "quarterly" | "yearly" {
  if (period === "quarter") return "quarterly";
  if (period === "year") return "yearly";
  return "monthly";
}

export function dashboardDateRange(period: DashboardPeriod): DateRange {
  return getDateRange(period);
}

export function periodOption(period: DashboardPeriod) {
  return (
    DASHBOARD_PERIOD_OPTIONS.find((option) => option.value === period) ??
    DASHBOARD_PERIOD_OPTIONS[1]
  );
}

export function budgetBandTitle(
  period: DashboardPeriod,
  kind: "budgets" | "income",
): string {
  const prefix = kind === "income" ? "Projected income" : "Budgets";
  if (period === "quarter") return `${prefix} this quarter`;
  if (period === "year") return `${prefix} this year`;
  return `${prefix} this month`;
}

export function registerHref(filters: {
  type?: "income" | "expense" | "giving";
  category?: string;
  startDate?: string;
  endDate?: string;
}): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.category) params.set("category", filters.category);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  const query = params.toString();
  return query ? `/dashboard/transactions?${query}` : "/dashboard/transactions";
}
