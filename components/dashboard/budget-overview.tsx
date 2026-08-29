"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, TrendingDown } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiBudget } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { SectionHeading } from "@/components/dashboard/panel";
import {
  budgetApiPeriod,
  budgetBandTitle,
  dashboardDateRange,
  registerHref,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

function BudgetSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function BudgetOverview({ period }: { period: DashboardPeriod }) {
  const grain = budgetApiPeriod(period);
  const range = dashboardDateRange(period);
  const { data, loading } = useApiQuery<{ budgets: ApiBudget[] }>(
    `/api/budgets?period=${grain}`,
  );
  const budgets = data?.budgets;

  const topBudgets = useMemo(() => {
    if (!budgets) return [];

    return budgets
      .filter((budget) => budget.type !== "income")
      .map((budget) => ({
        id: budget.id,
        category: budget.category,
        amount: budget.amount,
        spent: budget.spent,
        remaining: budget.remaining,
        type: budget.type,
        percentage: budget.percentage,
        status: budget.status,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [budgets]);

  if (loading || budgets === undefined) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle as="h2">Budgets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <BudgetSkeleton />
          <BudgetSkeleton />
          <BudgetSkeleton />
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const daysRemaining =
    grain === "monthly"
      ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
      : null;

  const header = (
    <SectionHeading
      title={budgetBandTitle(period, "budgets")}
      aside={
        daysRemaining == null
          ? undefined
          : daysRemaining === 0
            ? "Last day"
            : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining`
      }
    />
  );

  if (topBudgets.length === 0) {
    return (
      <section>
        {header}
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
              <TrendingDown className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No budgets set</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first budget to track progress.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/dashboard/settings#budgets">
                <Plus />
                Create budget
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      {header}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topBudgets.map((budget) => {
          const giving = budget.type === "giving";
          const over = !giving && budget.status === "exceeded";
          const near = !giving && budget.status === "warning";
          const statusTone = giving
            ? "text-giving"
            : over
              ? "text-expense"
              : near
                ? "text-obligation"
                : "text-muted-foreground";
          const fill = giving
            ? "bg-giving"
            : over
              ? "bg-expense"
              : near
                ? "bg-obligation"
                : "bg-foreground/70";
          const href = giving
            ? "/dashboard/giving"
            : registerHref({
                type: "expense",
                category: budget.category,
                startDate: range.startDate,
                endDate: range.endDate,
              });
          const remainder = giving
            ? budget.remaining >= 0
              ? `${formatCurrency(budget.remaining)} to target`
              : `${formatCurrency(Math.abs(budget.remaining))} past target`
            : budget.remaining >= 0
              ? `${formatCurrency(budget.remaining)} left`
              : `${formatCurrency(Math.abs(budget.remaining))} over`;

          return (
            <Link
              key={budget.id}
              href={href}
              className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-[18px]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[13.5px] font-medium">{budget.category}</p>
                <p className={`flex-none text-[12.5px] font-semibold tabular-nums ${statusTone}`}>
                  {Math.round(budget.percentage)}%
                </p>
              </div>

              <div
                role="progressbar"
                aria-valuenow={Math.min(Math.round(budget.percentage), 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={
                  giving
                    ? `${budget.category} given toward target`
                    : `${budget.category} budget used`
                }
                className="my-3 h-[5px] overflow-hidden rounded-full bg-track"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${fill}`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(budget.spent)} of {formatCurrency(budget.amount)}
                {" · "}
                <span className={statusTone}>{remainder}</span>
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
