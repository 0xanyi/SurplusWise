"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { getDueState } from "@/lib/outgoings-date";
import type { ApiRecurringOutgoing } from "@/types";

/**
 * How many outgoings are unpaid and already due. Shared so the sidebar badge
 * and the mobile tab badge always show the same number.
 */
export function useDueOutgoingsCount(): number {
  const { data } = useApiQuery<{ outgoings: ApiRecurringOutgoing[] }>(
    "/api/recurring-outgoings"
  );

  return useMemo(() => {
    if (!data?.outgoings) return 0;
    const now = new Date();
    return data.outgoings.filter(
      (o) =>
        o.is_active &&
        !o.payment_status?.paid &&
        getDueState(o.day_of_month, false, now).isDueNow
    ).length;
  }, [data]);
}
