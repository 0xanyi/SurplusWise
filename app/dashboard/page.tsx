"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileText, Loader2, RefreshCw } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatSignedAmount, moneyTypeTone } from "@/lib/money-type";
import {
  DASHBOARD_PERIOD_OPTIONS,
  dashboardDateRange,
  periodOption,
  registerHref,
} from "@/lib/dashboard-period";
import { useDashboardPeriod } from "@/hooks/use-dashboard-period";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageHeaderActions } from "@/components/dashboard/page-header-actions";
import { NetPositionHero } from "@/components/dashboard/net-position-hero";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { BudgetOverview } from "@/components/dashboard/budget-overview";
import { ProjectedIncomeOverview } from "@/components/dashboard/projected-income-overview";
import { GoalsOverview } from "@/components/dashboard/goals-overview";
import { NetWorthOverview } from "@/components/dashboard/net-worth-overview";
import { ClientsOverview } from "@/components/dashboard/clients/clients-overview";
import { OnboardingCard } from "@/components/dashboard/onboarding-card";
import { quietLink } from "@/components/dashboard/panel";
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

interface OnboardingResponse {
  completed: boolean;
}

const ANALYTICS_UNAVAILABLE =
  "Couldn't load your totals for this period. The figures below are unavailable, not zero.";
const ACTIVITY_UNAVAILABLE = "Couldn't load recent activity. This list is unavailable, not empty.";

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const { activeWorkspace } = useWorkspace();
  const userId = session?.user?.id;
  const firstName = session?.user?.name?.split(" ")[0] || "there";
  const [period, setPeriod] = useDashboardPeriod();

  const [totals, setTotals] = useState<AnalyticsResponse | undefined>(undefined);
  const [recentTransactions, setRecentTransactions] = useState<ApiTransaction[] | undefined>(
    undefined,
  );
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | undefined>(undefined);

  const loadData = useCallback(async () => {
    if (!userId) return;

    const range = dashboardDateRange(period);

    const analyticsPromise = apiFetch<AnalyticsResponse>(`/api/analytics?period=${period}`)
      .then((data) => {
        setTotals(data);
        setAnalyticsError(null);
      })
      .catch((error) => {
        console.error("Failed to fetch analytics:", error);
        setTotals(undefined);
        setAnalyticsError(ANALYTICS_UNAVAILABLE);
      });

    const transactionsPromise = apiFetch<TransactionsResponse>(
      `/api/transactions?pageSize=6&startDate=${range.startDate}&endDate=${range.endDate}`,
    )
      .then((recentData) => {
        setRecentTransactions(recentData.transactions);
        setTransactionsError(null);
      })
      .catch((error) => {
        console.error("Failed to fetch recent transactions:", error);
        setRecentTransactions(undefined);
        setTransactionsError(ACTIVITY_UNAVAILABLE);
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

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("workspace-changed", handler);
    return () => window.removeEventListener("workspace-changed", handler);
  }, [loadData]);

  const analyticsSettled = totals !== undefined || analyticsError !== null;

  if (!userId || !analyticsSettled) {
    return (
      <div
        className="flex min-h-[320px] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading dashboard</span>
      </div>
    );
  }

  const activeOption = periodOption(period);
  const range = dashboardDateRange(period);
  const ember = Boolean(totals && totals.netBalance < 0);

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
              "min-h-7 rounded-[7px] px-2.5 py-1 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2",
              ember
                ? "focus-visible:ring-hero-debt-ink/80"
                : "focus-visible:ring-hero-accent/80",
              active
                ? ember
                  ? "bg-hero-debt-ink/20 font-semibold text-hero-debt-ink"
                  : "bg-hero-accent/20 font-semibold text-hero-accent"
                : ember
                  ? "font-medium text-hero-debt-muted hover:text-hero-debt-ink"
                  : "font-medium text-hero-muted hover:text-hero-ink",
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
        actions={<PageHeaderActions onTransactionAdded={loadData} />}
      />
      {analyticsError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <span>{analyticsError}</span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 self-start sm:self-auto"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <NetPositionHero
        totals={totals ?? null}
        periodControl={periodControl}
        periodLabel={activeOption.label}
        startDate={range.startDate}
        endDate={range.endDate}
      />

      {onboardingCompleted === false && <OnboardingCard onCompleted={loadData} />}

      <section className="grid gap-4 lg:grid-cols-2">
        <NeedsAttention period={period} />
        <UpcomingBills />
      </section>

      <section>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3.5 sm:px-6">
            <h2 className="font-display text-base font-semibold leading-none tracking-[-0.015em]">
              Recent activity
            </h2>
            <Link
              href={registerHref({ startDate: range.startDate, endDate: range.endDate })}
              className={quietLink}
            >
              View all
            </Link>
          </div>
          <CardContent className="p-0">
            {transactionsError ? (
              <div className="px-5 py-12 text-center sm:px-6" role="status">
                <p className="text-sm text-muted-foreground">{transactionsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? <Loader2 className="size-3 animate-spin" /> : null}
                  Retry
                </Button>
              </div>
            ) : recentTransactions === undefined ? (
              <div
                className="flex justify-center py-12"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="sr-only">Loading recent activity</span>
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="px-5 py-12 text-center sm:px-6">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium">No transactions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use Add to create your first entry.
                </p>
              </div>
            ) : (
              <ul>
                {recentTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 border-t border-border/60 px-5 py-3.5 sm:px-6"
                  >
                    <span
                      className={cn(
                        "size-[7px] flex-none rounded-full",
                        moneyTypeTone(tx.type).bg,
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {tx.payee || tx.category}
                      </span>
                      <span className="block truncate text-xs capitalize text-muted-foreground">
                        {tx.payee ? `${tx.category} · ` : null}
                        {tx.type} · {new Date(tx.date).toLocaleDateString("en-GB")}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex-none text-sm font-semibold tabular-nums",
                        moneyTypeTone(tx.type).text,
                      )}
                    >
                      {formatSignedAmount(tx.type, tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <ProjectedIncomeOverview period={period} />
      <BudgetOverview period={period} />
      <NetWorthOverview />
      <ClientsOverview />
      <GoalsOverview />
    </div>
  );
}
