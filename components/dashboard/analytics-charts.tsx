"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Download, Calendar, TrendingDown, TrendingUp, Wallet, PiggyBank, Sparkles, Target, Receipt, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Period = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface AnalyticsComparisons {
  expensesChange: number | null;
  givingsChange: number | null;
  incomeChange: number | null;
  netBalanceChange: number | null;
  transactionCountChange: number | null;
}

interface SafeToSpendBreakdown {
  available: number;
  committedExpenses: number;
  activeGoalsAllocation: number;
  remaining: number;
}

interface SpendingPrediction {
  projectedMonthlyExpenses: number;
  projectedMonthlyIncome: number;
  daysOfRunway: number | null;
  trendDirection: "improving" | "stable" | "declining";
  insight: string;
}

interface AnalyticsData {
  totalExpenses: number;
  totalGivings: number;
  totalIncome: number;
  netBalance: number;
  safeToSpend: number;
  safeToSpendBreakdown: SafeToSpendBreakdown;
  spendingPrediction: SpendingPrediction;
  transactionCount: number;
  expensesByCategoryArray: { name: string; value: number }[];
  givingsByCategoryArray: { name: string; value: number }[];
  incomeByCategoryArray: { name: string; value: number }[];
  dailyTrends: { date: string; expenses: number; givings: number; income: number }[];
  monthlyTrends: { month: string; expenses: number; givings: number; income: number }[];
  period: DateRange;
  previousPeriod: DateRange;
  comparisons: AnalyticsComparisons;
}

// Every slice is an expense category, so the palette varies Outflow Rose without
// assigning income, giving, or obligation meaning to an expense.
const EXPENSE_CATEGORY_COLORS = [
  "var(--color-expense-chart-1)",
  "var(--color-expense-chart-2)",
  "var(--color-expense-chart-3)",
  "var(--color-expense-chart-4)",
  "var(--color-expense-chart-5)",
  "var(--color-expense-chart-6)",
];

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "weekly", label: "Last 7 days" },
  { value: "monthly", label: "Last 30 days" },
  { value: "quarterly", label: "Last 3 months" },
  { value: "yearly", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

function formatChangeLabel(value: number | null) {
  if (value === null) return "No prior data";
  if (Math.abs(value) < 0.05) return "No change";
  const direction = value > 0 ? "up" : "down";
  return `${Math.abs(value).toFixed(1)}% ${direction}`;
}

function getComparisonTone(value: number | null, positiveIsGood = true) {
  if (value === null || Math.abs(value) < 0.05) return "text-muted-foreground";
  const improved = positiveIsGood ? value > 0 : value < 0;
  return improved ? "text-foreground" : "text-expense";
}

function ComparisonHint({
  value,
  positiveIsGood,
}: {
  value: number | null;
  positiveIsGood?: boolean;
}) {
  const tone = getComparisonTone(value, positiveIsGood);

  return <p className={`mt-1 text-xs ${tone}`}>{formatChangeLabel(value)}</p>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

/** The month you are in reads brighter — the spec's one emphasis on this axis. */
function MonthTick({ x, y, payload, series }: any) {
  const point = series[payload.index];
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={11}
      fontWeight={point?.isCurrent ? 600 : 400}
      fill={point?.isCurrent ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
    >
      {payload.value}
    </text>
  );
}

function LegendKey({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-[7px] rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  hint,
  last,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-3 ${
        last ? "" : "border-b border-border/60"
      }`}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="flex flex-col items-end">
        <span className={`text-sm font-semibold tabular-nums ${tone ?? ""}`}>{value}</span>
        {hint}
      </span>
    </div>
  );
}

function CategoryList({
  title,
  items,
}: {
  title: string;
  items: { name: string; value: number }[];
}) {
  const topItems = items.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {topItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">{item.name}</span>
                <span className="font-medium tabular-nums">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsCharts() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("yearly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/analytics?period=${period}`;
      if (period === "custom" && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to load analytics");
      }

      const data = (await response.json()) as AnalyticsData;
      setAnalytics(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load analytics";
      toast({ title: "Error", description: message, variant: "destructive" });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, toast]);

  useEffect(() => {
    if (period === "custom" && (!startDate || !endDate)) {
      return;
    }
    fetchAnalytics();
  }, [fetchAnalytics, period, startDate, endDate]);

  /**
   * monthlyTrends only carries months that had transactions, so a twelve-month
   * chart drawn straight from it has holes. Zero-fill across the returned
   * window: a month with nothing in it really is nil, and the gap between two
   * bars should read as time passing, not as missing data.
   */
  const monthSeries = useMemo(() => {
    if (!analytics) return [];
    const byMonth = new Map(analytics.monthlyTrends.map((m) => [m.month, m]));
    const start = new Date(`${analytics.period.startDate}T00:00:00`);
    const end = new Date(`${analytics.period.endDate}T00:00:00`);

    const out: { key: string; label: string; income: number; expenses: number; givings: number; isCurrent: boolean }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // 36 is a guard, not a limit — the longest window the picker offers is 12.
    for (let i = 0; i < 36 && cursor <= end; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const hit = byMonth.get(key);
      out.push({
        key,
        label: cursor.toLocaleDateString("en-GB", { month: "short" }),
        income: hit?.income ?? 0,
        expenses: hit?.expenses ?? 0,
        givings: hit?.givings ?? 0,
        isCurrent: key === currentKey,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [analytics]);

  /** Top expense categories with their share, for the tonal-ramp breakdown. */
  const topExpenses = useMemo(() => {
    if (!analytics) return [];
    const total = analytics.expensesByCategoryArray.reduce((sum, c) => sum + c.value, 0);
    if (total === 0) return [];
    return analytics.expensesByCategoryArray.slice(0, 5).map((c) => ({
      name: c.name,
      value: c.value,
      share: Math.round((c.value / total) * 100),
    }));
  }, [analytics]);

  /** Spend per month actually covered by the window, not per calendar month. */
  const averageMonthlySpend = useMemo(() => {
    if (!analytics) return 0;
    const months = Math.max(1, monthSeries.length);
    return analytics.totalExpenses / months;
  }, [analytics, monthSeries]);

  const netBalance = useMemo(() => {
    if (!analytics) return 0;
    return analytics.netBalance;
  }, [analytics]);

  const periodSummary = useMemo(() => {
    if (!analytics) return null;

    const currentStart = new Date(`${analytics.period.startDate}T00:00:00`);
    const currentEnd = new Date(`${analytics.period.endDate}T00:00:00`);
    const previousStart = new Date(`${analytics.previousPeriod.startDate}T00:00:00`);
    const previousEnd = new Date(`${analytics.previousPeriod.endDate}T00:00:00`);

    return {
      current: `${currentStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${currentEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      previous: `${previousStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${previousEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    };
  }, [analytics]);

  const chartData = useMemo(() => {
    if (!analytics) return [];

    if (period === "yearly") {
      return analytics.monthlyTrends.map((item) => ({
        label: item.month,
        income: item.income,
        expenses: item.expenses,
        givings: item.givings,
      }));
    }

    return analytics.dailyTrends.map((item) => ({
      label: item.date,
      income: item.income,
      expenses: item.expenses,
      givings: item.givings,
    }));
  }, [analytics, period]);

  const exportCsv = () => {
    if (!analytics) return;

    const rows = [
      ["Category", "Type", "Amount"],
      ...analytics.incomeByCategoryArray.map((item) => [item.name, "Income", item.value.toString()]),
      ...analytics.expensesByCategoryArray.map((item) => [item.name, "Expense", item.value.toString()]),
      ...analytics.givingsByCategoryArray.map((item) => [item.name, "Giving", item.value.toString()]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `sika-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!analytics) {
    return <p className="text-sm text-muted-foreground">No report data available.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
          <div
            role="group"
            aria-label="Reporting period"
            className="flex flex-wrap gap-1.5"
          >
            {PERIOD_OPTIONS.map((option) => {
              const active = option.value === period;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-[10px] px-3.5 py-2 text-[12.5px] transition-colors ${
                    active
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "border border-border font-medium text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {periodSummary && (
        <p className="text-sm text-muted-foreground">
          Comparing <span className="font-medium text-foreground">{periodSummary.current}</span> with <span className="font-medium text-foreground">{periodSummary.previous}</span>
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 pb-5 sm:flex-row sm:items-baseline sm:justify-between sm:space-y-0">
          <CardTitle>Money in and out</CardTitle>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <LegendKey className="bg-income" label="Income" />
            <LegendKey className="bg-expense" label="Expenses" />
            <LegendKey className="bg-giving" label="Giving" />
          </div>
        </CardHeader>
        <CardContent>
          {monthSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthSeries} barGap={3} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={<MonthTick series={monthSeries} />}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  /* Compact on the axis, full currency in the tooltip — a
                     y-axis that spells out every pound crowds out the bars. */
                  tickFormatter={(v) =>
                    new Intl.NumberFormat("en", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(Number(v))
                  }
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
                <Bar dataKey="income" name="Income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={11} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={11} />
                <Bar dataKey="givings" name="Giving" fill="var(--color-giving)" radius={[4, 4, 0, 0]} maxBarSize={11} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Where the money went</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {topExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No expense categories for this period.
              </p>
            ) : (
              topExpenses.map((row, i) => (
                <div key={row.name}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="truncate pr-3">{row.name}</span>
                    <span className="flex-none tabular-nums text-muted-foreground">
                      {formatCurrency(row.value)} · {row.share}%
                    </span>
                  </div>
                  {/* A breakdown of one money type stays within that type's
                      tonal ramp — see the Single-Type Chart Rule. */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-track">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${row.share}%`,
                        background: EXPENSE_CATEGORY_COLORS[i % EXPENSE_CATEGORY_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            <SummaryRow
              label="Total income"
              value={formatCurrency(analytics.totalIncome)}
              tone="text-income"
              hint={<ComparisonHint value={analytics.comparisons.incomeChange} />}
            />
            <SummaryRow
              label="Total expenses"
              value={formatCurrency(analytics.totalExpenses)}
              tone="text-expense"
              hint={<ComparisonHint value={analytics.comparisons.expensesChange} positiveIsGood={false} />}
            />
            <SummaryRow
              label="Total giving"
              value={formatCurrency(analytics.totalGivings)}
              tone="text-giving"
              hint={<ComparisonHint value={analytics.comparisons.givingsChange} />}
            />
            <SummaryRow
              label="Average monthly spend"
              value={formatCurrency(averageMonthlySpend)}
            />
            {/* Kept is neutral: a surplus is not giving. */}
            <SummaryRow
              label="Kept"
              value={`${formatCurrency(netBalance)}${
                analytics.totalIncome > 0
                  ? ` · ${Math.round((netBalance / analytics.totalIncome) * 100)}%`
                  : ""
              }`}
              last
            />
          </CardContent>
        </Card>
      </div>

      {/* The app's own forecasting, condensed to two panels. It is not in the
          prototype, but it is real analysis the redesign should not delete —
          it just belongs after the figures it is forecasting from. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand" />
              Looking ahead
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            <SummaryRow
              label="Projected monthly income"
              value={formatCurrency(analytics.spendingPrediction.projectedMonthlyIncome)}
              tone="text-income"
            />
            <SummaryRow
              label="Projected monthly expenses"
              value={formatCurrency(analytics.spendingPrediction.projectedMonthlyExpenses)}
              tone="text-expense"
            />
            <SummaryRow
              label="Days of runway"
              value={
                analytics.spendingPrediction.daysOfRunway === null
                  ? "Unlimited"
                  : `${analytics.spendingPrediction.daysOfRunway} days`
              }
              tone={
                analytics.spendingPrediction.daysOfRunway !== null &&
                analytics.spendingPrediction.daysOfRunway <= 30
                  ? "text-expense"
                  : undefined
              }
            />
            <SummaryRow
              label="Trend"
              value={
                analytics.spendingPrediction.trendDirection.charAt(0).toUpperCase() +
                analytics.spendingPrediction.trendDirection.slice(1)
              }
              tone={
                analytics.spendingPrediction.trendDirection === "declining"
                  ? "text-expense"
                  : undefined
              }
              last
            />
            <p className="mt-4 rounded-xl bg-secondary px-3.5 py-3 text-[12.5px] text-muted-foreground">
              {analytics.spendingPrediction.insight}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" />
              Safe to spend
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            <SummaryRow
              label="Available"
              value={formatCurrency(analytics.safeToSpendBreakdown.available)}
            />
            <SummaryRow
              label="Committed expenses"
              value={`−${formatCurrency(analytics.safeToSpendBreakdown.committedExpenses)}`}
              tone="text-expense"
            />
            <SummaryRow
              label="Active goals"
              value={`−${formatCurrency(analytics.safeToSpendBreakdown.activeGoalsAllocation)}`}
              tone="text-obligation"
            />
            <SummaryRow
              label="Remaining"
              value={formatCurrency(analytics.safeToSpendBreakdown.remaining)}
              tone={
                analytics.safeToSpendBreakdown.remaining >= 0 ? undefined : "text-expense"
              }
              last
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expenses are already broken down by "Where the money went" above;
            repeating them here was the same table twice on one page. */}
        <CategoryList title="Income by category" items={analytics.incomeByCategoryArray} />
        <CategoryList title="Giving by category" items={analytics.givingsByCategoryArray} />
      </div>

    </div>
  );
}
