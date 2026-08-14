"use client";

import Link from "next/link";
import { PiggyBank, Target } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiGoal } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/dashboard/panel";

interface GoalsResponse {
  goals: ApiGoal[];
  total_target: number;
  total_current: number;
  active_count: number;
  completion_rate: number;
}

export function GoalsOverview() {
  const { data, loading } = useApiQuery<GoalsResponse>("/api/goals");

  if (loading || !data) {
    return (
      <section>
        <SectionHeading title="Goals" />
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Loading goals...
          </CardContent>
        </Card>
      </section>
    );
  }

  const activeGoals = data.goals.filter((goal) => goal.is_active).slice(0, 3);

  if (activeGoals.length === 0) {
    return (
      <section>
        <SectionHeading title="Goals" />
        <Card>
          <CardContent className="py-8 text-center">
            <PiggyBank className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="font-medium">No goals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a savings goal to track progress.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/dashboard/settings">
                <Target />
                Create goal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading
        title="Goals"
        aside={`${formatCurrency(data.total_current)} saved of ${formatCurrency(
          data.total_target
        )}`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeGoals.map((goal) => (
          <Link
            key={goal.id}
            href="/dashboard/settings#goals"
            className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/30 sm:px-[18px]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium">{goal.name}</p>
              <div
                role="progressbar"
                aria-valuenow={Math.min(Math.round(goal.progress), 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${goal.name} goal progress`}
                className="mt-2.5 h-1 overflow-hidden rounded-full bg-track"
              >
                <div
                  className="h-full rounded-full bg-foreground/70 transition-all duration-500"
                  style={{ width: `${Math.min(goal.progress, 100)}%` }}
                />
              </div>
            </div>
            <span className="flex-none text-[13px] font-semibold text-muted-foreground tabular-nums">
              {goal.monthly_contribution !== null && goal.funding_status === "scheduled"
                ? `${formatCurrency(goal.monthly_contribution)}/mo`
                : `${goal.progress.toFixed(0)}%`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
