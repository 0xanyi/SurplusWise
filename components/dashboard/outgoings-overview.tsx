"use client";

import Link from "next/link";
import { Receipt, CalendarDays, Loader2 } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiRecurringOutgoing } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function getDueDateForMonth(year: number, monthIndex: number, dayOfMonth: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDay));
}

function getNextDueDate(dayOfMonth: number, reference: Date): Date {
  const startOfToday = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dueThisMonth = getDueDateForMonth(reference.getFullYear(), reference.getMonth(), dayOfMonth);
  if (dueThisMonth >= startOfToday) return dueThisMonth;
  return getDueDateForMonth(reference.getFullYear(), reference.getMonth() + 1, dayOfMonth);
}

interface OutgoingsResponse {
  outgoings: ApiRecurringOutgoing[];
  monthly_total: number;
  active_count: number;
}

export function OutgoingsOverview() {
  const { data, loading, error, refresh } = useApiQuery<OutgoingsResponse>("/api/recurring-outgoings");

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Monthly Outgoings</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Monthly Outgoings</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load outgoings."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { outgoings, monthly_total } = data;
  const activeOutgoings = outgoings.filter((o) => o.is_active);
  const scheduledMonthlyOutgoings = activeOutgoings.filter((o) => o.frequency === "monthly");
  const unsupportedFrequencyCount = activeOutgoings.length - scheduledMonthlyOutgoings.length;

  const referenceDate = new Date();
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  // Sort by real upcoming due date and show the next few upcoming monthly outgoings
  const sorted = [...scheduledMonthlyOutgoings].sort(
    (a, b) => getNextDueDate(a.day_of_month, referenceDate).getTime() - getNextDueDate(b.day_of_month, referenceDate).getTime(),
  );
  const upcoming = sorted.slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base sm:text-lg">Monthly Outgoings</CardTitle>
        <Link href="/dashboard/outgoings">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {scheduledMonthlyOutgoings.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Receipt className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No outgoings tracked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your regular bills to track them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-rose-50/50 dark:bg-rose-950/20 p-3">
              <span className="text-sm text-muted-foreground">Total per month</span>
              <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrency(monthly_total)}
              </span>
            </div>

            {unsupportedFrequencyCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unsupportedFrequencyCount} non-monthly outgoing{unsupportedFrequencyCount === 1 ? "" : "s"} not included in upcoming schedule.
              </p>
            )}

            <div className="space-y-1.5">
              {upcoming.map((item) => {
                const dueDate = getNextDueDate(item.day_of_month, referenceDate);
                const isToday = dueDate.getTime() === startOfToday.getTime();
                const isNextMonth = dueDate.getMonth() !== referenceDate.getMonth();
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className={`size-3.5 ${isToday ? "text-amber-500" : "text-muted-foreground"}`} />
                      <span className="font-medium">{item.name}</span>
                      {isToday && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                          Today
                        </span>
                      )}
                      {!isToday && isNextMonth && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                          Next month
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums text-rose-600 dark:text-rose-400">
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.day_of_month}{getOrdinalSuffix(item.day_of_month)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
