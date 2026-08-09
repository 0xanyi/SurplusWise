"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiBudget, ApiRecurringOutgoing } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { getDueState } from "@/lib/outgoings-date";
import { EmptyState } from "@/components/dashboard/panel";

interface OutgoingsResponse {
  outgoings: ApiRecurringOutgoing[];
}

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  amount: number;
  icon: LucideIcon;
  /**
   * The money type, not the urgency. A bill falling due is an obligation
   * however late it is; an overrun is money that already left. Urgency is
   * carried by the icon, the wording and the sort order — see the
   * Token-Or-Nothing and Earned Ink rules in DESIGN.md.
   */
  tone: "expense" | "obligation";
  /** Lower sorts first. */
  rank: number;
  href: string;
}

const MAX_VISIBLE = 6;

const TONE = {
  expense: { text: "text-expense", surface: "bg-expense-surface" },
  obligation: { text: "text-obligation", surface: "bg-obligation-surface" },
} as const;

/**
 * One list instead of three cards. Overdue bills and blown budgets are the same
 * question — "what needs me today" — so they belong in the same place, sorted
 * by urgency rather than by which table they came from.
 */
export function NeedsAttention() {
  const {
    data: outgoingsData,
    loading: outgoingsLoading,
    error: outgoingsError,
    refresh: refreshOutgoings,
  } = useApiQuery<OutgoingsResponse>("/api/recurring-outgoings");
  const {
    data: budgetsData,
    loading: budgetsLoading,
    error: budgetsError,
    refresh: refreshBudgets,
  } = useApiQuery<{ budgets: ApiBudget[] }>("/api/budgets?period=monthly");

  const items = useMemo<AttentionItem[]>(() => {
    const result: AttentionItem[] = [];
    const now = new Date();

    for (const outgoing of outgoingsData?.outgoings ?? []) {
      if (!outgoing.is_active || outgoing.payment_status?.paid) continue;

      const { dueDate, daysUntilDue, urgency, isDueNow } = getDueState(
        outgoing.day_of_month,
        false,
        now
      );
      if (!isDueNow) continue;

      const overdue = urgency === "overdue";
      const days = Math.abs(daysUntilDue);
      result.push({
        id: `outgoing-${outgoing.id}`,
        title: overdue
          ? `${outgoing.name} is ${days} ${days === 1 ? "day" : "days"} overdue`
          : `${outgoing.name} due today`,
        detail: `Due ${dueDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })} · ${outgoing.frequency}`,
        amount: outgoing.amount,
        icon: overdue ? AlertCircle : Clock,
        tone: "obligation",
        rank: overdue ? 0 : 1,
        href: "/dashboard/outgoings",
      });
    }

    for (const budget of budgetsData?.budgets ?? []) {
      if (!budget.is_active) continue;
      if (budget.status !== "exceeded" && budget.status !== "warning") continue;

      const exceeded = budget.status === "exceeded";
      result.push({
        id: `budget-${budget.id}`,
        title: exceeded
          ? `${budget.category} is over budget`
          : `${budget.category} near its limit`,
        detail: exceeded
          ? `${formatCurrency(budget.spent)} spent of ${formatCurrency(budget.amount)}`
          : `${Math.round(budget.percentage)}% used`,
        amount: Math.abs(budget.remaining),
        icon: exceeded ? TrendingDown : AlertTriangle,
        // Over budget is money that already left; nearing a limit is a caution.
        tone: exceeded ? "expense" : "obligation",
        rank: exceeded ? 0 : 1,
        href: "/dashboard/settings",
      });
    }

    return result.sort((a, b) => a.rank - b.rank || b.amount - a.amount);
  }, [outgoingsData, budgetsData]);

  // The list is capped, the count is not — a badge reading "6 items" when nine
  // need you is worse than no badge.
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, MAX_VISIBLE);

  const loading = outgoingsLoading || budgetsLoading;
  // "Nothing needs you" is a claim about the data. If a request failed we do
  // not have the data to make it, so say that instead of the all-clear.
  const error = outgoingsError ?? budgetsError;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3.5">
        <CardTitle>Needs your attention</CardTitle>
        {!loading && !error && items.length > 0 && (
          <span className="rounded-md bg-obligation-surface px-2 py-0.5 text-[11.5px] font-semibold text-obligation tabular-nums">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                refreshOutgoings();
                refreshBudgets();
              }}
            >
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing needs you right now"
            description="No overdue bills and no budgets over their limit."
          />
        ) : (
          <ul>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const tone = TONE[item.tone];
              return (
                <li key={item.id} className="border-t border-border/60">
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/40 sm:px-6"
                  >
                    <span
                      className={cn(
                        "flex size-[30px] flex-none items-center justify-center rounded-[10px]",
                        tone.surface
                      )}
                    >
                      <Icon className={cn("size-[15px]", tone.text)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex-none text-sm font-semibold tabular-nums",
                        tone.text
                      )}
                    >
                      {formatCurrency(item.amount)}
                    </span>
                  </Link>
                </li>
              );
            })}
            {items.length > MAX_VISIBLE && (
              <li className="border-t border-border/60">
                {/* Expands in place. The hidden rows are a mix of bills and
                    budgets with different destinations, so no single link can
                    be the right one. */}
                <button
                  type="button"
                  onClick={() => setShowAll((prev) => !prev)}
                  aria-expanded={showAll}
                  className="block w-full px-5 py-3 text-left text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-6"
                >
                  {showAll
                    ? "Show fewer"
                    : `${items.length - MAX_VISIBLE} more need you`}
                </button>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
