"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiBudget } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { SectionHeading } from "@/components/dashboard/panel";
import {
  incomeProjectionCopy,
  summarizeProjectedIncome,
} from "@/lib/projected-income";
import {
  budgetApiPeriod,
  budgetBandTitle,
  dashboardDateRange,
  registerHref,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

function ProjectionSkeleton() {
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

export function ProjectedIncomeOverview({ period }: { period: DashboardPeriod }) {
  const grain = budgetApiPeriod(period);
  const range = dashboardDateRange(period);
  const { data, loading } = useApiQuery<{ budgets: ApiBudget[] }>(
    `/api/budgets?period=${grain}`,
  );
  const budgets = data?.budgets;

  const projections = useMemo(() => {
    if (!budgets) return [];
    return budgets.filter((budget) => budget.type === "income");
  }, [budgets]);

  const totals = useMemo(
    () => summarizeProjectedIncome(projections),
    [projections],
  );

  if (loading || budgets === undefined) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Projected income</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ProjectionSkeleton />
          <ProjectionSkeleton />
        </CardContent>
      </Card>
    );
  }

  const header = (
    <SectionHeading
      title={budgetBandTitle(period, "income")}
      aside={
        projections.length === 0
          ? undefined
          : `${formatCurrency(totals.received)} received of ${formatCurrency(totals.expected)}`
      }
    />
  );

  if (projections.length === 0) {
    return (
      <section>
        {header}
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
              <TrendingUp className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No projected income</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Set what you expect to receive this month.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/dashboard/settings#projected-income">
                <Plus />
                Add projected income
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
        {projections.map((projection) => {
          const outstanding = projection.amount - projection.spent;
          const note = incomeProjectionCopy(outstanding, formatCurrency);

          return (
            <Link
              key={projection.id}
              href={registerHref({
                type: "income",
                category: projection.category,
                startDate: range.startDate,
                endDate: range.endDate,
              })}
              className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-[18px]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[13.5px] font-medium">
                  {projection.category}
                </p>
                <p className="flex-none text-[12.5px] font-semibold tabular-nums text-income">
                  {Math.round(projection.percentage)}%
                </p>
              </div>

              <div
                role="progressbar"
                aria-valuenow={Math.min(Math.round(projection.percentage), 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${projection.category} income received`}
                className="my-3 h-[5px] overflow-hidden rounded-full bg-track"
              >
                <div
                  className="h-full rounded-full bg-income transition-all duration-500"
                  style={{
                    width: `${Math.min(projection.percentage, 100)}%`,
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(projection.spent)} of{" "}
                {formatCurrency(projection.amount)}
                {" · "}
                <span>{note}</span>
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
