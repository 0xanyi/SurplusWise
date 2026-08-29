"use client";

import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { moneyTypeTone } from "@/lib/money-type";
import {
  netPositionFigure,
  netPositionSentence,
  netPositionSplit,
  type NetPositionTotals,
} from "@/lib/net-position";
import { registerHref } from "@/lib/dashboard-period";
import type { TransactionType } from "@/types";

interface NetPositionHeroProps {
  /** `null` means totals failed to load — never substitute zeros. */
  totals: NetPositionTotals | null;
  /** Rendered inside the hero, top right — usually the period picker. */
  periodControl?: React.ReactNode;
  periodLabel: string;
  startDate: string;
  endDate: string;
}

interface Tile {
  label: string;
  value: number | undefined;
  type: TransactionType;
  note: string;
  href: string;
}

/**
 * The dashboard's anchor: one figure large enough to answer "how did I do"
 * before you read anything else, with the in / out / kept split as a single
 * bar rather than three competing cards.
 */
export function NetPositionHero({
  totals,
  periodControl,
  periodLabel,
  startDate,
  endDate,
}: NetPositionHeroProps) {
  const unavailable = totals === null;
  const deficit = Boolean(totals && totals.netBalance < 0);
  const split = totals ? netPositionSplit(totals) : null;
  const sentence = totals
    ? netPositionSentence(totals, formatCurrency)
    : "Totals unavailable";

  const tiles: Tile[] = [
    {
      label: "Income",
      value: totals?.totalIncome,
      type: "income",
      note: unavailable ? "Unavailable" : periodLabel,
      href: registerHref({ type: "income", startDate, endDate }),
    },
    {
      label: "Expenses",
      value: totals?.totalExpenses,
      type: "expense",
      note: unavailable
        ? "Unavailable"
        : split?.hasIncome
          ? `${Math.round(split.spentPct)}% of income`
          : "No income to compare",
      href: registerHref({ type: "expense", startDate, endDate }),
    },
    {
      label: "Giving",
      value: totals?.totalGivings,
      type: "giving",
      note: unavailable
        ? "Unavailable"
        : split?.hasIncome
          ? `${Math.round(split.givenPct)}% of income`
          : "No income to compare",
      href: "/dashboard/giving",
    },
  ];

  const barLabel = unavailable
    ? "Totals unavailable"
    : split?.barMode === "income-share"
      ? `Spent ${Math.round(split.spentPct)} percent, given ${Math.round(
          split.givenPct,
        )} percent, kept ${Math.round(split.keptPct)} percent of income`
      : split?.barMode === "outflow-share" && totals
        ? `${formatCurrency(totals.totalExpenses)} spent, ${formatCurrency(totals.totalGivings)} given, no income in this window`
        : "No money moved in this window";

  const ink = deficit ? "text-hero-debt-ink" : "text-hero-ink";
  const muted = deficit ? "text-hero-debt-muted" : "text-hero-muted";
  const kicker = deficit ? "text-hero-debt-ink" : "text-hero-accent";
  const keptSwatch = deficit ? "bg-hero-debt-ink/25" : "bg-hero-ink/25";
  const emptyTrack = deficit ? "bg-hero-debt-ink/15" : "bg-hero-ink/15";

  return (
    <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <div
        className={cn(
          "flex min-h-[220px] flex-col justify-between rounded-[20px] p-6 sm:p-7",
          deficit ? "bg-hero-debt" : "bg-hero",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <p className={cn("text-[12.5px] font-medium", kicker)}>
              Net position · {periodLabel.toLowerCase()}
            </p>
            {deficit && (
              <span className="rounded-md bg-hero-debt-ink/15 px-2 py-0.5 text-[11.5px] font-semibold text-hero-debt-ink">
                Deficit
              </span>
            )}
          </div>
          {periodControl}
        </div>

        <div className="py-6" aria-live="polite">
          {deficit ? <p className="sr-only">Deficit</p> : null}
          <p
            className={cn(
              "font-display text-[42px] font-semibold leading-none tracking-[-0.035em] tabular-nums sm:text-[60px]",
              ink,
            )}
          >
            {unavailable || !totals ? "£—" : netPositionFigure(totals.netBalance, formatCurrency)}
          </p>
          <p className={cn("mt-2.5 text-[13.5px]", muted)}>{sentence}</p>
        </div>

        <div>
          <div
            className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={barLabel}
          >
            {!unavailable && split && split.spentWidth > 0 && (
              <div className="rounded-full bg-expense" style={{ width: `${split.spentWidth}%` }} />
            )}
            {!unavailable && split && split.givenWidth > 0 && (
              <div className="rounded-full bg-giving" style={{ width: `${split.givenWidth}%` }} />
            )}
            {!unavailable && split && split.keptWidth > 0 && (
              <div
                className={cn("rounded-full", keptSwatch)}
                style={{ width: `${split.keptWidth}%` }}
              />
            )}
            {(unavailable || split?.barMode === "empty") && (
              <div className={cn("w-full rounded-full", emptyTrack)} />
            )}
          </div>
          <div className={cn("mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs", muted)}>
            {unavailable ? (
              <span>Unavailable, not zero</span>
            ) : split?.barMode === "income-share" ? (
              <>
                <Legend swatch="bg-expense" label={`Spent ${Math.round(split.spentPct)}%`} />
                <Legend swatch="bg-giving" label={`Given ${Math.round(split.givenPct)}%`} />
                <Legend swatch={keptSwatch} label={`Kept ${Math.round(split.keptPct)}%`} />
              </>
            ) : split?.barMode === "outflow-share" && totals ? (
              <>
                <Legend
                  swatch="bg-expense"
                  label={`${formatCurrency(totals.totalExpenses)} spent`}
                />
                <Legend
                  swatch="bg-giving"
                  label={`${formatCurrency(totals.totalGivings)} given`}
                />
              </>
            ) : (
              <span>No income, spending, or giving in this window</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-border hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-[18px]"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                {tile.label}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-[23px] font-semibold tracking-[-0.02em] tabular-nums",
                  tile.value === undefined
                    ? "text-muted-foreground"
                    : moneyTypeTone(tile.type).text,
                )}
              >
                {tile.value === undefined ? "—" : formatCurrency(tile.value)}
              </p>
            </div>
            <span className="flex-none rounded-md bg-secondary px-2 py-1 text-[11.5px] font-medium text-muted-foreground tabular-nums">
              {tile.note}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-[7px] rounded-full", swatch)} />
      {label}
    </span>
  );
}
