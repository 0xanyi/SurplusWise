"use client";

import Link from "next/link";
import { useApiQuery } from "@/hooks/use-api";
import { usePartyLabels } from "@/hooks/use-party-labels";
import type { ApiClient } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface ClientsResponse {
  clients: ApiClient[];
  totals: {
    fronted: number;
    received: number;
    not_yet_recovered: number;
    monthly_fronted: number;
  };
}

/**
 * The clients band on the Overview.
 *
 * It also carries the only route to the page on a phone: the tab bar holds five
 * slots and this is not one of them. Renders nothing until a client exists, so
 * a personal install that never uses the feature never sees it.
 */
export function ClientsOverview() {
  const labels = usePartyLabels();
  const { data } = useApiQuery<ClientsResponse>("/api/clients");

  if (!data || data.clients.length === 0) return null;

  const { totals, clients } = data;
  const outstanding = totals.not_yet_recovered > 0;
  // Margin can be negative long before anything is genuinely unrecovered — a
  // bundled cost expects no separate recovery, so it lands here rather than in
  // notYetRecovered. The sign has to be read before the label is chosen.
  const margin = totals.received - totals.fronted;

  const headline = outstanding
    ? "Not yet recovered"
    : margin >= 0
      ? "Margin to date"
      : `Behind on ${labels.lowerPlural}`;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-6 pt-5 sm:pt-6">
        <div>
          <p className="text-xs text-muted-foreground">{headline}</p>
          <p
            className={`mt-1.5 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-4xl ${
              outstanding ? "text-obligation" : ""
            }`}
          >
            {formatCurrency(
              outstanding ? totals.not_yet_recovered : Math.abs(margin),
            )}
          </p>
          <p className="mt-2 text-[12.5px] text-muted-foreground tabular-nums">
            {formatCurrency(totals.monthly_fronted)} a month carried for{" "}
            {clients.length} {clients.length === 1 ? labels.lowerSingular : labels.lowerPlural}
          </p>
        </div>

        <Link
          href="/dashboard/clients"
          className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
        </Link>
      </CardContent>
    </Card>
  );
}
