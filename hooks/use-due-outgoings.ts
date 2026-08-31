"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { getDueState } from "@/lib/outgoings-date";
type RecurringMoneyItem = {
  is_active: boolean
  day_of_month: number
  occurrence: { recorded_amount: number; outstanding_amount: number } | null
}

function itemIsPaid(item: RecurringMoneyItem) {
  return Boolean(
    item.occurrence &&
      item.occurrence.recorded_amount > 0 &&
      item.occurrence.outstanding_amount === 0,
  );
}

/**
 * How many outgoings are unpaid and already due. Shared so the sidebar badge
 * and the mobile tab badge always show the same number.
 */
export function useDueOutgoingsCount(): number {
  const { data } = useApiQuery<{ items: RecurringMoneyItem[] }>(
    "/api/recurring-money?type=expense"
  );

  return useMemo(() => {
    if (!data?.items) return 0;
    const now = new Date();
    return data.items.filter(
      (o) =>
        o.is_active &&
        !itemIsPaid(o) &&
        getDueState(o.day_of_month, false, now).isDueNow
    ).length;
  }, [data]);
}
