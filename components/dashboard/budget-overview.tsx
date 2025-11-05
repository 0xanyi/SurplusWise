"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, TrendingUp, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: string;
  type: string;
  spent: number;
  remaining: number;
  percentage: number;
  status: "ok" | "warning" | "exceeded";
}

export function BudgetOverview() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    try {
      const response = await fetch("/api/budgets?period=monthly");
      const data = await response.json();
      // Show only top 3 budgets
      setBudgets((data.budgets || []).slice(0, 3));
    } catch (error) {
      console.error("Failed to fetch budgets:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading budgets...</p>
        </CardContent>
      </Card>
    );
  }

  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              No budgets set for this month
            </p>
            <Link href="/dashboard/settings">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Budget
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Budget Overview</CardTitle>
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
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                  <span className="text-sm font-medium">{budget.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(budget.status === 'warning' || budget.status === 'exceeded') && (
                    <AlertTriangle
                      className={`h-4 w-4 ${
                        budget.status === 'exceeded' ? 'text-red-600' : 'text-amber-500'
                      }`}
                    />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                  </span>
                </div>
              </div>

              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    budget.status === 'exceeded'
                      ? 'bg-red-600'
                      : budget.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-green-600'
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
