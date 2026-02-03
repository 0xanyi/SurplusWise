"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, TrendingUp, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { ApiBudget } from "@/types";
import Link from "next/link";

function BudgetSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function BudgetOverview() {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<ApiBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBudgets = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/budgets?period=monthly", {
        signal: controller.signal,
      });
      const data = await response.json();
      setBudgets((data.budgets || []).slice(0, 3));
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      console.error("Failed to fetch budgets:", error);
      toast({
        title: "Error",
        description: "Failed to load budget data",
        variant: "destructive",
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    fetchBudgets();
    return () => abortRef.current?.abort();
  }, [fetchBudgets]);

  if (loading) {
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

  if (budgets.length === 0) {
    return (
       <Card className="border shadow-sm">
         <CardHeader className="pb-4">
           <CardTitle className="text-lg font-semibold">Budget Overview</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="text-center py-8">
             <div className="size-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
               <TrendingUp className="size-6 text-muted-foreground" />
             </div>
             <p className="font-medium">No budgets set</p>
             <p className="text-sm text-muted-foreground mt-1 mb-4">
              No budgets set for this month
            </p>
            <Link href="/dashboard/settings">
               <Button size="sm" className="shadow-sm">
                 <Plus className="size-4 mr-2" />
                Create Budget
              </Button>
            </Link>
          </div>
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
      <CardContent>
        <div className="space-y-4">
          {budgets.map((budget) => (
            <div key={budget.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {budget.type === "expense" ? (
                     <TrendingDown className="size-4 text-rose-500" />
                  ) : (
                     <TrendingUp className="size-4 text-emerald-500" />
                  )}
                  <span className="text-sm font-medium">{budget.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(budget.status === 'warning' || budget.status === 'exceeded') && (
                    <AlertTriangle
                       className={`size-4 ${
                         budget.status === 'exceeded' ? 'text-rose-600' : 'text-amber-500'
                      }`}
                    />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                  </span>
                </div>
              </div>

               <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                   className={`h-2 rounded-full transition-all duration-300 ${
                    budget.status === 'exceeded'
                       ? 'bg-rose-600'
                      : budget.status === 'warning'
                      ? 'bg-amber-500'
                       : 'bg-emerald-600'
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
        </div>
      </CardContent>
    </Card>
  );
}
