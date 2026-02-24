"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDownRight, ArrowUpRight, FileText, Loader2, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { formatCurrency, cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { BudgetOverview } from "@/components/dashboard/budget-overview";
import { OutgoingsOverview } from "@/components/dashboard/outgoings-overview";
import { DebtsOverview } from "@/components/dashboard/debts-overview";
import { LoansOverview } from "@/components/dashboard/loans-overview";
import { InvestmentsOverview } from "@/components/dashboard/investments-overview";
import type { ApiTransaction } from "@/types";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface TransactionsResponse {
  transactions: ApiTransaction[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface AnalyticsResponse {
  totalIncome: number;
  totalExpenses: number;
  totalGivings: number;
  netBalance: number;
}

const ZERO_TOTALS: AnalyticsResponse = {
  totalIncome: 0,
  totalExpenses: 0,
  totalGivings: 0,
  netBalance: 0,
};

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const [totals, setTotals] = useState<AnalyticsResponse | undefined>(undefined);
  const [recentTransactions, setRecentTransactions] = useState<ApiTransaction[] | undefined>(undefined);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;

    setAnalyticsError(null);

    const analyticsPromise = fetch("/api/analytics?period=month")
      .then(async (res) => {
        if (res.ok) {
          const data: AnalyticsResponse = await res.json();
          setTotals(data);
          setAnalyticsError(null);
        } else {
          console.error("Analytics API error:", res.status);
          setTotals(ZERO_TOTALS);
          setAnalyticsError("Unable to load analytics. Showing zero totals.");
        }
      })
      .catch((error) => {
        console.error("Failed to fetch analytics:", error);
        setTotals(ZERO_TOTALS);
        setAnalyticsError("Unable to load analytics. Showing zero totals.");
      });

    const transactionsPromise = fetch("/api/transactions?pageSize=6")
      .then(async (res) => {
        if (res.ok) {
          const recentData: TransactionsResponse = await res.json();
          setRecentTransactions(recentData.transactions);
        } else {
          setRecentTransactions([]);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch recent transactions:", error);
        setRecentTransactions([]);
      });

    await Promise.all([analyticsPromise, transactionsPromise]);
  }, [userId]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await loadData();
    setIsRetrying(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!userId || totals === undefined) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { totalIncome, totalExpenses, totalGivings, netBalance } = totals;

  const summary = [
    {
      title: "Income",
      value: totalIncome,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      icon: TrendingUp,
    },
    {
      title: "Expenses",
      value: totalExpenses,
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
      icon: ArrowDownRight,
    },
    {
      title: "Giving",
      value: totalGivings,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      icon: ArrowUpRight,
    },
    {
      title: "Net balance",
      value: Math.abs(netBalance),
      subtitle: netBalance >= 0 ? "Surplus" : "Deficit",
      color: netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      bgColor: netBalance >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-rose-50 dark:bg-rose-950/30",
      icon: Wallet,
    },
  ];

  const recent = recentTransactions ?? [];

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {getGreeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Here&apos;s your {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} snapshot.
        </p>
      </div>

      {analyticsError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{analyticsError}</span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? <Loader2 className="mr-1 size-3 animate-spin" /> : <RefreshCw className="mr-1 size-3" />}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {summary.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4 sm:pb-2 sm:p-6">
                <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{card.title}</CardTitle>
                <div className={cn("rounded-lg p-1.5 sm:p-2", card.bgColor)}>
                  <Icon className={cn("size-3.5 sm:size-4", card.color)} />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:p-6 sm:pt-0">
                <div className={cn("text-lg font-semibold tabular-nums sm:text-2xl", card.color)}>{formatCurrency(card.value)}</div>
                {card.subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">{card.subtitle}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DashboardClient onDataChanged={loadData} />

      <BudgetOverview />

      <div className="grid gap-4 md:grid-cols-2">
        <OutgoingsOverview />
        <DebtsOverview />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LoansOverview />
        <InvestmentsOverview />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base sm:text-lg">Recent transactions</CardTitle>
          <Link href="/dashboard/transactions">
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground">
              View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <p className="font-medium">No transactions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Use Quick add to create your first entry.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-border/50 p-3.5 transition-colors hover:bg-accent/30">
                  <div>
                    <p className="text-sm font-medium sm:text-base">{tx.category}</p>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      {tx.type} · {new Date(tx.date).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "font-semibold tabular-nums",
                      tx.type === "income"
                        ? "text-blue-600 dark:text-blue-400"
                        : tx.type === "giving"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {tx.type === "expense" ? "-" : "+"}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
