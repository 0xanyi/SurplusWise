"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiBudget } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

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

export function BudgetOverview() {
  const { data, loading } = useApiQuery<{ budgets: ApiBudget[] }>("/api/budgets?period=monthly");
  const budgets = data?.budgets;

  const topBudgets = useMemo(() => {
    if (!budgets) return [];

    return budgets
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
          <CardTitle>Budget Overview</CardTitle>
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
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  const header = (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
        Budgets this month
      </h2>
      <span className="text-[12.5px] text-muted-foreground tabular-nums">
        {daysRemaining === 0
          ? "Last day"
          : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining`}
      </span>
    </div>
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
              <Link href="/dashboard/settings">
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
          const over = budget.status === "exceeded";
          const near = budget.status === "warning";
          const statusTone = over
            ? "text-expense"
            : near
            ? "text-obligation"
            : "text-muted-foreground";

          return (
            <div
              key={budget.id}
              className="rounded-2xl border border-border/70 bg-card p-4 sm:px-[18px]"
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
                aria-label={`${budget.category} budget used`}
                className="my-3 h-[5px] overflow-hidden rounded-full bg-track"
              >
                {/* On track is neutral ink: staying under budget is not giving. */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    over ? "bg-expense" : near ? "bg-obligation" : "bg-foreground/70"
                  }`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>

              {/* The bar's colour also encodes status, so name it in words. */}
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(budget.spent)} of {formatCurrency(budget.amount)}
                {" · "}
                <span className={statusTone}>
                  {budget.remaining >= 0
                    ? `${formatCurrency(budget.remaining)} left`
                    : `${formatCurrency(Math.abs(budget.remaining))} over`}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
