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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-2 w-full" />
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
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Budget Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BudgetSkeleton />
          <BudgetSkeleton />
          <BudgetSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (topBudgets.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Budget Overview</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="font-medium">No budgets set</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first budget to track progress.</p>
          <Link href="/dashboard/settings" className="mt-4 inline-flex">
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              Create Budget
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Budget Overview</CardTitle>
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {topBudgets.map((budget) => (
          <div key={budget.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                {budget.type === "expense" ? (
                  <TrendingDown className="size-4 text-rose-500" />
                ) : (
                  <TrendingUp
                    className={`size-4 ${budget.type === "income" ? "text-blue-500" : "text-emerald-500"}`}
                  />
                )}
                {budget.category}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {(budget.status === "warning" || budget.status === "exceeded") && (
                  <AlertTriangle
                    className={`size-4 ${budget.status === "exceeded" ? "text-rose-600" : "text-amber-500"}`}
                  />
                )}
                <span>
                  {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                </span>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  budget.status === "exceeded"
                    ? "bg-rose-500"
                    : budget.status === "warning"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(budget.percentage, 100)}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {budget.remaining >= 0
                ? `${formatCurrency(budget.remaining)} remaining`
                : `${formatCurrency(Math.abs(budget.remaining))} over budget`}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
