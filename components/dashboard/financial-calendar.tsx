"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Loader2,
} from "lucide-react";
import { apiFetch, useWorkspaceCurrency } from "@/hooks/use-api";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ApiFinancialCalendarEvent } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, StatTile } from "@/components/dashboard/panel";

interface CalendarResponse {
  period_month: string;
  events: ApiFinancialCalendarEvent[];
  summary: {
    expected_income: number;
    expected_outflow: number;
    incoming_outstanding: number;
    outgoing_outstanding: number;
  };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function currentPeriodMonth() {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

function shiftMonth(periodMonth: string, offset: number) {
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 10);
}

function monthLabel(periodMonth: string) {
  return new Date(`${periodMonth}T12:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function eventTone(type: ApiFinancialCalendarEvent["type"]) {
  switch (type) {
    case "income":
      return { dot: "bg-income", surface: "bg-income-surface", text: "text-income" };
    case "giving":
      return { dot: "bg-giving", surface: "bg-giving-surface", text: "text-giving" };
    case "debt":
      return {
        dot: "bg-obligation",
        surface: "bg-obligation-surface",
        text: "text-obligation",
      };
    default:
      return { dot: "bg-expense", surface: "bg-expense-surface", text: "text-expense" };
  }
}

function statusLabel(event: ApiFinancialCalendarEvent) {
  if (event.status === "partial") return "Part paid";
  if (event.status === "settled") return "Settled";
  if (event.status === "overpaid") return "Overpaid";
  if (event.certainty === "statement") return "Statement amount";
  if (event.certainty === "estimate") return "Estimated";
  return "Expected";
}

function CalendarEvent({ event, currency, compact = false }: {
  event: ApiFinancialCalendarEvent;
  currency: string;
  compact?: boolean;
}) {
  const tone = eventTone(event.type);
  return (
    <Link
      href={event.href}
      title={`${event.title}: ${formatCurrency(event.amount, currency)} · ${statusLabel(event)}`}
      className={cn(
        "group block rounded-lg transition-colors hover:brightness-95 dark:hover:brightness-110",
        tone.surface,
        compact ? "px-2 py-1.5" : "p-3",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("size-1.5 flex-none rounded-full", tone.dot)} />
        <span className={cn("min-w-0 flex-1 truncate font-medium", compact ? "text-[11px]" : "text-sm")}>
          {event.title}
        </span>
        {event.status === "settled" && <CircleCheck className="size-3.5 flex-none text-income" />}
      </div>
      {compact ? (
        <p className={cn("mt-0.5 truncate pl-3.5 text-[10px] font-semibold tabular-nums", tone.text)}>
          {formatCurrency(event.amount, currency)}
        </p>
      ) : (
        <div className="mt-1.5 flex items-baseline justify-between gap-3 pl-3.5">
          <span className="text-[11px] text-muted-foreground">{statusLabel(event)}</span>
          <span className={cn("text-sm font-semibold tabular-nums", tone.text)}>
            {formatCurrency(event.amount, currency)}
          </span>
        </div>
      )}
    </Link>
  );
}

export function FinancialCalendar() {
  const currency = useWorkspaceCurrency();
  const { activeWorkspace } = useWorkspace();
  const [periodMonth, setPeriodMonth] = useState(currentPeriodMonth);
  const [data, setData] = useState<CalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<CalendarResponse>("/api/financial-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodMonth }),
      });
      if (version === requestVersion.current) setData(result);
    } catch (loadError) {
      if (version === requestVersion.current) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load calendar");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [activeWorkspace, periodMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    const [year, month] = periodMonth.split("-").map(Number);
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mondayOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const calendarDays = [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: dayCount }, (_, index) => index + 1),
    ];
    return [
      ...calendarDays,
      ...Array.from({ length: (7 - (calendarDays.length % 7)) % 7 }, () => null),
    ];
  }, [periodMonth]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<number, ApiFinancialCalendarEvent[]>();
    for (const event of data?.events ?? []) {
      const day = Number(event.date.slice(8));
      grouped.set(day, [...(grouped.get(day) ?? []), event]);
    }
    return grouped;
  }, [data]);
  const today = new Date();
  const todayKey = currentPeriodMonth();

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-col gap-3 rounded-[18px] border border-border/70 bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setPeriodMonth((month) => shiftMonth(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <h2 className="min-w-[170px] text-center font-display text-lg font-semibold tracking-[-0.015em]">
            {monthLabel(periodMonth)}
          </h2>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setPeriodMonth((month) => shiftMonth(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={periodMonth === todayKey}
          onClick={() => setPeriodMonth(todayKey)}
        >
          Today
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-[18px] border border-border/70 bg-card">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error || !data ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="Calendar unavailable"
            description={error ?? "The calendar could not be loaded."}
            action={<Button variant="outline" onClick={load}>Retry</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatTile
              label="Expected income"
              value={formatCurrency(data.summary.expected_income, currency)}
              tone="text-income"
            />
            <StatTile
              label="Expected outflow"
              value={formatCurrency(data.summary.expected_outflow, currency)}
              tone="text-expense"
            />
            <StatTile
              label="Income still due"
              value={formatCurrency(data.summary.incoming_outstanding, currency)}
              tone={data.summary.incoming_outstanding > 0 ? "text-obligation" : undefined}
            />
            <StatTile
              label="Payments still due"
              value={formatCurrency(data.summary.outgoing_outstanding, currency)}
              tone={data.summary.outgoing_outstanding > 0 ? "text-obligation" : undefined}
            />
          </div>

          <Card className="hidden overflow-hidden md:block">
            <div className="grid grid-cols-7 border-b border-border/70 bg-sunken">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {weekday}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const events = day == null ? [] : (eventsByDay.get(day) ?? []);
                const isToday =
                  periodMonth === todayKey && day === today.getUTCDate();
                return (
                  <div
                    key={`${day ?? "blank"}-${index}`}
                    className={cn(
                      "min-h-[128px] border-b border-r border-border/60 p-2 last:border-r-0",
                      day == null && "bg-sunken/50",
                    )}
                  >
                    {day != null && (
                      <>
                        <span className={cn(
                          "mb-2 flex size-7 items-center justify-center rounded-full text-xs tabular-nums",
                          isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                        )}>
                          {day}
                        </span>
                        <div className="space-y-1">
                          {events.slice(0, 3).map((event) => (
                            <CalendarEvent key={event.id} event={event} currency={currency} compact />
                          ))}
                          {events.length > 3 && (
                            <p className="px-2 text-[10.5px] text-muted-foreground">
                              +{events.length - 3} more
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-4 md:hidden">
            {data.events.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CalendarDays}
                  title="Nothing scheduled"
                  description="Add recurring money or debt payment dates to build this month."
                />
              </Card>
            ) : (
              [...eventsByDay.entries()].map(([day, events]) => (
                <section key={day}>
                  <div className="mb-2 flex items-baseline gap-2 px-1">
                    <span className="font-display text-lg font-semibold tabular-nums">{day}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(`${periodMonth.slice(0, 8)}${String(day).padStart(2, "0")}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <CalendarEvent key={event.id} event={event} currency={currency} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          <Card>
            <CardContent className="flex flex-wrap gap-x-5 gap-y-2 py-4 text-xs text-muted-foreground sm:py-4">
              {[
                ["bg-income", "Income"],
                ["bg-expense", "Expense"],
                ["bg-giving", "Giving"],
                ["bg-obligation", "Debt payment"],
              ].map(([tone, label]) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", tone)} />
                  {label}
                </span>
              ))}
              <span className="ml-auto">Estimates are labelled; statement figures are kept distinct.</span>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
