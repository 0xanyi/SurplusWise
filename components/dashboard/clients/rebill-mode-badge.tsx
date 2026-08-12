"use client";

import type { RebillMode } from "@/types";
import { cn } from "@/lib/utils";

/**
 * How a cost comes back, in words.
 *
 * Every mode states its terms in text rather than by colour: the badge is the
 * only thing distinguishing an amber "not yet recovered" figure from a healthy
 * one, and WCAG 1.4.1 does not allow that to be a hue.
 */
const MODE_COPY: Record<RebillMode, { label: string; hint: string }> = {
  none: { label: "Own cost", hint: "Nobody else pays for this" },
  at_cost: { label: "At cost", hint: "Recovered at exactly what it cost" },
  fixed: { label: "Fixed price", hint: "Recovered at your own price" },
  bundled: { label: "In retainer", hint: "Already covered by their retainer" },
};

export function rebillModeLabel(mode: RebillMode): string {
  return MODE_COPY[mode].label;
}

export function rebillModeHint(mode: RebillMode): string {
  return MODE_COPY[mode].hint;
}

export function RebillModeBadge({
  mode,
  className,
}: {
  mode: RebillMode;
  className?: string;
}) {
  return (
    <span
      title={MODE_COPY[mode].hint}
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {MODE_COPY[mode].label}
    </span>
  );
}
