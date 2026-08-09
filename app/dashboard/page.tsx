"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileText, Loader2, RefreshCw } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/hooks/use-api";
import { formatCurrency, cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { NetPositionHero } from "@/components/dashboard/net-position-hero";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { BudgetOverview } from "@/components/dashboard/budget-overview";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { NetWorthOverview } from "@/components/dashboard/net-worth-overview";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { useWorkspace } from "@/contexts/workspace-context";
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

type DashboardPeriod = "week" | "month" | "quarter" | "year";

const DASHBOARD_PERIOD_OPTIONS: {
  value: DashboardPeriod;
  short: string;
  label: string;
}[] = [
  { value: "week", short: "7D", label: "Last 7 days" },
  { value: "month", short: "30D", label: "Last 30 days" },
  { value: "quarter", short: "3M", label: "Last 3 months" },
  { value: "year", short: "1Y", label: "Last 12 months" },
];

interface OnboardingResponse {
  completed: boolean;
}

const ZERO_TOTALS: AnalyticsResponse = {
  totalIncome: 0,
  totalExpenses: 0,
  totalGivings: 0,
  netBalance: 0,
};

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const { activeWorkspace } = useWorkspace();
  const userId = session?.user?.id;
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const [totals, setTotals] = useState<AnalyticsResponse | undefined>(undefined);
  const [recentTransactions, setRecentTransactions] = useState<ApiTransaction[] | undefined>(undefined);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | undefined>(undefined);
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  const loadData = useCallback(async () => {
    if (!userId) return;

    setAnalyticsError(null);

    const analyticsPromise = apiFetch<AnalyticsResponse>(`/api/analytics?period=${period}`)
      .then((data) => {
        setTotals(data);
        setAnalyticsError(null);
      })
      .catch((error) => {
        console.error("Failed to fetch analytics:", error);
        setTotals(ZERO_TOTALS);
        setAnalyticsError("Unable to load analytics. Showing zero totals.");
      });

    const transactionsPromise = apiFetch<TransactionsResponse>("/api/transactions?pageSize=6")
      .then((recentData) => {
        setRecentTransactions(recentData.transactions);
      })
      .catch((error) => {
        console.error("Failed to fetch recent transactions:", error);
        setRecentTransactions([]);
      });

    const onboardingPromise = apiFetch<OnboardingResponse>("/api/onboarding")
      .then((status) => {
        setOnboardingCompleted(status.completed);
      })
      .catch(() => {
        setOnboardingCompleted(true);
      });

    await Promise.all([analyticsPromise, transactionsPromise, onboardingPromise]);
  }, [period, userId]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await loadData();
    setIsRetrying(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-fetch when workspace changes
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [loadData]);

  if (!userId || totals === undefined) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { totalIncome, totalExpenses, totalGivings, netBalance } = totals;
  const activeOption =
    DASHBOARD_PERIOD_OPTIONS.find((o) => o.value === period) ??
    DASHBOARD_PERIOD_OPTIONS[1];
  const recent = recentTransactions ?? [];

  const periodControl = (
    <div
      role="group"
      aria-label="Dashboard period"
      className="flex flex-none gap-1 rounded-[9px] bg-black/25 p-[3px]"
    >
      {DASHBOARD_PERIOD_OPTIONS.map((option) => {
        const active = option.value === period;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            aria-pressed={active}
            title={option.label}
            className={cn(
              "rounded-[7px] px-2.5 py-1 text-[11.5px] transition-colors",
              active
                ? "bg-hero-accent/20 font-semibold text-hero-accent"
                : "font-medium text-hero-muted hover:text-hero-ink"
            )}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-[26px] pb-4">
      <PageHeader
        kicker={
          activeWorkspace ? `${activeWorkspace.name} workspace` : "Your workspace"
        }
        title={`${getGreeting()}, ${firstName}`}
      />

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
              {isRetrying ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Band 1 — the anchor figure */}
      <NetPositionHero
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        totalGivings={totalGivings}
        netBalance={netBalance}
        periodControl={periodControl}
        periodLabel={activeOption.label}
      />

      <DashboardClient onDataChanged={loadData} />

      {onboardingCompleted === false && <OnboardingCard onCompleted={loadData} />}

      {/* Band 2 — what is late, and what is next */}
      <section className="grid gap-4 lg:grid-cols-2">
        <NeedsAttention />
        <UpcomingBills />
      </section>

      {/* Band 3 — what just happened */}
      <section>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3.5">
            <CardTitle>Recent activity</CardTitle>
            <Link
              href="/dashboard/transactions"
              className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="px-5 py-12 text-center sm:px-6">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium">No transactions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use Quick add to create your first entry.
                </p>
              </div>
            ) : (
              <ul>
                {recent.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 border-t border-border/60 px-5 py-3.5 sm:px-6"
                  >
                    <span
                      className={cn(
                        "size-[7px] flex-none rounded-full",
                        tx.type === "income"
                          ? "bg-income"
                          : tx.type === "giving"
                          ? "bg-giving"
                          : "bg-expense"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {tx.category}
                      </span>
                      <span className="block truncate text-xs capitalize text-muted-foreground">
                        {tx.type} · {new Date(tx.date).toLocaleDateString("en-GB")}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex-none text-sm font-semibold tabular-nums",
                        tx.type === "income"
                          ? "text-income"
                          : tx.type === "giving"
                          ? "text-giving"
                          : "text-foreground"
                      )}
                    >
                      {tx.type === "expense" ? "−" : "+"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Band 4 — budgets */}
      <BudgetOverview />

      {/* Band 5 — the balance sheet, in one figure */}
      <NetWorthOverview />

      {/* Band 6 — goals */}
      <GoalsOverview />
    </div>
  );
}
