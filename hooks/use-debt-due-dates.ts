"use client";

import { useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiUpcomingDebtPayment } from "@/types";
import { getDueState, getDueStateForDate, type DueState } from "@/lib/outgoings-date";

interface DebtsResponse {
  upcoming?: ApiUpcomingDebtPayment[];
}

export interface DebtDueItem {
  id: string;
  name: string;
  amount: number;
  /** True when the amount is a statement's actual minimum, not a forecast. */
  amountIsActual: boolean;
  due: DueState;
}

/**
 * Debts that are expecting a payment, shaped like the recurring-outgoings rows
 * the dashboard panels already render.
 *
 * A statement's exact due date is preferred; a debt with no statement falls back
 * to its configured payment day so it still appears. Debts with nothing owed, no
 * amount, and no date at all drop out rather than showing a blank row, and so do
 * debts already settled — mirroring how a paid outgoing leaves these panels.
 */
export function useDebtDueDates() {
  const { data, loading, error } = useApiQuery<DebtsResponse>("/api/debts-credits");

  const items = useMemo<DebtDueItem[]>(() => {
    const now = new Date();

    return (data?.upcoming ?? [])
      .flatMap((debt) => {
        if (debt.amount == null || debt.amount <= 0) return [];
        if (debt.current_balance <= 0) return [];
        if (debt.settled) return [];

        const due = debt.due_date
          ? getDueStateForDate(debt.due_date, now)
          : debt.payment_day_of_month != null
            ? getDueState(debt.payment_day_of_month, false, now)
            : null;

        if (!due) return [];

        return [
          {
            id: debt.id,
            name: debt.name,
            amount: debt.amount,
            amountIsActual: debt.amount_is_actual,
            due,
          },
        ];
      })
      .sort((a, b) => a.due.daysUntilDue - b.due.daysUntilDue);
  }, [data]);

  return { items, loading, error };
}
