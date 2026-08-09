"use client";

import { useMemo } from "react";
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
import { cn, formatCurrency } from "@/lib/utils";
import {
  getDaysUntilDue,
  getDueUrgency,
  getEffectiveDueDate,
} from "@/lib/outgoings-date";

interface OutgoingsResponse {
  outgoings: ApiRecurringOutgoing[];
}

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  amount: number;
  icon: LucideIcon;
  /** expense = needs action now, obligation = needs action soon. */
  tone: "expense" | "obligation";
  /** Lower sorts first. */
  rank: number;
  href: string;
}

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
  const { data: outgoingsData, loading: outgoingsLoading } =
    useApiQuery<OutgoingsResponse>("/api/recurring-outgoings");
  const { data: budgetsData, loading: budgetsLoading } = useApiQuery<{
    budgets: ApiBudget[];
  }>("/api/budgets?period=monthly");

  const items = useMemo<AttentionItem[]>(() => {
    const result: AttentionItem[] = [];
    const now = new Date();

    for (const outgoing of outgoingsData?.outgoings ?? []) {
      if (!outgoing.is_active || outgoing.payment_status?.paid) continue;

      const dueDate = getEffectiveDueDate(outgoing.day_of_month, false, now);
      const daysUntilDue = getDaysUntilDue(dueDate, now);
      const urgency = getDueUrgency(daysUntilDue);
      if (urgency !== "overdue" && urgency !== "today") continue;

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
        tone: overdue ? "expense" : "obligation",
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
        tone: exceeded ? "expense" : "obligation",
        rank: exceeded ? 0 : 1,
        href: "/dashboard/settings",
      });
    }

    return result.sort((a, b) => a.rank - b.rank || b.amount - a.amount).slice(0, 6);
  }, [outgoingsData, budgetsData]);

  const loading = outgoingsLoading || budgetsLoading;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3.5">
        <CardTitle>Needs your attention</CardTitle>
        {!loading && items.length > 0 && (
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
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
              <CheckCircle2 className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">Nothing needs you right now</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No overdue bills and no budgets over their limit.
            </p>
          </div>
        ) : (
          <ul>
            {items.map((item) => {
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
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
