"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiRecurringOutgoing } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDaysUntilDue, getDueState } from "@/lib/outgoings-date";
import { useDebtDueDates } from "@/hooks/use-debt-due-dates";

interface OutgoingsResponse {
  outgoings: ApiRecurringOutgoing[];
  monthly_total: number;
}

interface UpcomingRow {
  key: string;
  name: string;
  amount: number;
  dayLabel: string;
  daysUntilDue: number;
  isDueNow: boolean;
  urgency: string;
  /** Forecast rather than a figure off a statement. */
  isEstimate: boolean;
}

function ordinal(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * The forward half of the bills picture. "Needs your attention" owns everything
 * already due — overdue and due-today — so this deliberately starts at tomorrow
 * and never repeats a row that panel is showing.
 */
export function UpcomingBills() {
  const { data, loading, error, refresh } =
    useApiQuery<OutgoingsResponse>("/api/recurring-outgoings");
  const { items: debtDues } = useDebtDueDates();

  const { upcoming, unpaidTotal, committedTotal, hasBills } = useMemo(() => {
    const active = (data?.outgoings ?? []).filter((o) => o.is_active);
    const unpaid = active.filter((o) => !o.payment_status?.paid);
    const now = new Date();

    const dated: UpcomingRow[] = unpaid.map((outgoing) => {
      const due = getDueState(outgoing.day_of_month, false, now);
      return {
        key: outgoing.id,
        name: outgoing.name,
        amount: outgoing.amount,
        dayLabel: `${outgoing.day_of_month}${ordinal(outgoing.day_of_month)}`,
        daysUntilDue: due.daysUntilDue,
        isDueNow: due.isDueNow,
        urgency: due.urgency,
        isEstimate: false,
      };
    });

    // Debts sit in the same schedule as bills: a card minimum is as much a
    // commitment as a subscription, and was previously invisible here.
    for (const debt of debtDues) {
      dated.push({
        key: `debt-${debt.id}`,
        name: debt.name,
        amount: debt.amount,
        dayLabel: `${debt.due.dueDate.getDate()}${ordinal(debt.due.dueDate.getDate())}`,
        daysUntilDue: debt.due.daysUntilDue,
        isDueNow: debt.due.isDueNow,
        urgency: debt.due.urgency,
        isEstimate: !debt.amountIsActual,
      });
    }

    return {
      // The exact complement of NeedsAttention: it owns everything already due.
      upcoming: dated
        .filter((b) => !b.isDueNow)
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
        .slice(0, 5),
      unpaidTotal: dated.reduce((sum, b) => sum + b.amount, 0),
      // Debt minimums are counted in both tiles or neither. Counting them only
      // in "still unpaid" produced £0 committed against £31.70 unpaid.
      committedTotal:
        (data?.monthly_total ?? 0) + debtDues.reduce((sum, d) => sum + d.amount, 0),
      hasBills: active.length > 0 || debtDues.length > 0,
    };
  }, [data, debtDues]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3.5">
        <CardTitle>Coming up</CardTitle>
        <Link
          href="/dashboard/calendar"
          className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View calendar
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <p className="text-sm text-muted-foreground">
              {error ?? "Failed to load bills."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 px-5 pb-4 sm:px-6">
              <div className="rounded-2xl border border-border/70 bg-sunken p-4">
                <p className="text-xs text-muted-foreground">Committed each month</p>
                <p className="mt-1 font-display text-[23px] font-semibold tracking-[-0.02em] tabular-nums">
                  {formatCurrency(committedTotal)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-sunken p-4">
                <p className="text-xs text-muted-foreground">Still unpaid</p>
                <p
                  className={cn(
                    "mt-1 font-display text-[23px] font-semibold tracking-[-0.02em] tabular-nums",
                    unpaidTotal > 0 ? "text-obligation" : "text-foreground"
                  )}
                >
                  {formatCurrency(unpaidTotal)}
                </p>
              </div>
            </div>

            {!hasBills ? (
              <div className="border-t border-border/60 px-5 py-10 text-center sm:px-6">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
                  <Calendar className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium">No bills tracked</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add recurring outgoings to see them scheduled here.
                </p>
              </div>
            ) : upcoming.length === 0 ? (
              <div className="border-t border-border/60 px-5 py-10 text-center sm:px-6">
                <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
                  <CheckCircle2 className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium">Nothing else due this cycle</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every remaining bill is either paid or already listed as due.
                </p>
              </div>
            ) : (
              <ul>
                {upcoming.map((row) => {
                  const soon = row.urgency === "soon";
                  return (
                    <li
                      key={row.key}
                      className="flex items-center gap-3.5 border-t border-border/60 px-5 py-3.5 sm:px-6"
                    >
                      <span className="w-9 flex-none text-center text-xs text-muted-foreground tabular-nums">
                        {row.dayLabel}
                      </span>
                      <span
                        className={cn(
                          "flex-none",
                          soon ? "text-obligation" : "text-muted-foreground"
                        )}
                      >
                        {soon ? (
                          <Clock className="size-4" />
                        ) : (
                          <Calendar className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                        {row.name}
                      </span>
                      <span
                        className={cn(
                          "flex-none text-[11.5px]",
                          soon ? "text-obligation" : "text-muted-foreground"
                        )}
                      >
                        {formatDaysUntilDue(row.daysUntilDue)}
                      </span>
                      <span className="w-[90px] flex-none text-right text-sm font-semibold tabular-nums">
                        {row.isEstimate && (
                          <span className="mr-1 text-[10.5px] font-normal text-muted-foreground">
                            est.
                          </span>
                        )}
                        {formatCurrency(row.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
