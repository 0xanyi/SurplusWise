"use client";

import Link from "next/link";
import { PiggyBank, Target } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiGoal } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Goals</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading goals...</CardContent>
      </Card>
    );
  }

  const activeGoals = data.goals.filter((goal) => goal.is_active).slice(0, 3);

  if (activeGoals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Goals</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <PiggyBank className="mx-auto mb-3 h-10 w-10 text-primary/60" />
          <p className="font-medium">No goals yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Set a savings goal to track progress.</p>
          <Link href="/dashboard/settings" className="mt-4 inline-flex">
            <Button size="sm">
              <Target className="mr-2 h-4 w-4" />
              Create Goal
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>Goals</CardTitle>
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-primary/5 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Saved so far</span>
            <span className="font-semibold tabular-nums text-primary">{formatCurrency(data.total_current)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Target {formatCurrency(data.total_target)}</span>
            <span>{data.completion_rate.toFixed(0)}% complete</span>
          </div>
        </div>

        <div className="space-y-2">
          {activeGoals.map((goal) => (
            <div key={goal.id} className="rounded-lg border border-border/50 px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{goal.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{goal.category.replace(/_/g, " ")}</p>
                </div>
                <span className="font-medium tabular-nums">{goal.progress.toFixed(0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(goal.progress, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
