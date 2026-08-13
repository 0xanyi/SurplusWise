"use client";

import { useEffect, useState } from "react";
import { Download, FileBarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiQuery, useWorkspaceCurrency } from "@/hooks/use-api";
import { TRANSACTION_CHANGED_EVENT } from "@/lib/client-events";
import { formatCurrency } from "@/lib/utils";
import type { ApiAnnualGivingSummary } from "@/types";

function csvCell(value: string | number) {
  const text = String(value);
  const spreadsheetSafe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
}

export function AnnualGivingSummary() {
  const currency = useWorkspaceCurrency();
  const currentYear = new Date().getFullYear();
  const [yearInput, setYearInput] = useState(String(currentYear));
  const [year, setYear] = useState(currentYear);
  const query = useApiQuery<ApiAnnualGivingSummary>(`/api/giving-summary?year=${year}`);
  const refresh = query.refresh;

  useEffect(() => {
    window.addEventListener(TRANSACTION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TRANSACTION_CHANGED_EVENT, refresh);
  }, [refresh]);

  const validYear = /^\d{4}$/.test(yearInput) && Number(yearInput) >= 1900;
  const exportCsv = () => {
    if (!query.data) return;
    const rows: Array<Array<string | number>> = [
      ["Year", "Recipient", "Fund / designation", "Gift count", "Amount", "Currency"],
      ...query.data.recipients.flatMap((recipient) =>
        recipient.designations.map((designation) => [
          query.data!.year,
          recipient.recipient_name,
          designation.designation_name,
          designation.gift_count,
          designation.amount.toFixed(2),
          currency,
        ]),
      ),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(csvCell).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sika-giving-summary-${query.data.year}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Annual giving summary</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A personal record of giving by recipient and fund. This is not an official tax receipt.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="giving-summary-year" className="text-xs">Year</Label>
            <Input
              id="giving-summary-year"
              type="number"
              inputMode="numeric"
              min="1900"
              max="9999"
              value={yearInput}
              onChange={(event) => setYearInput(event.target.value)}
              className="mt-1 h-9 w-28"
            />
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!validYear} onClick={() => setYear(Number(yearInput))}>View</Button>
          <Button type="button" variant="outline" size="sm" disabled={!query.data || query.data.gift_count === 0} onClick={exportCsv}>
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {query.loading ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Building annual summary...</CardContent></Card>
      ) : query.error ? (
        <Card><CardContent className="pt-5 text-sm text-destructive">{query.error}</CardContent></Card>
      ) : query.data?.gift_count === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-giving-surface">
              <FileBarChart2 className="size-5 text-giving" />
            </div>
            <p className="font-medium">No giving recorded in {query.data.year}</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose another year or add a giving transaction.</p>
          </CardContent>
        </Card>
      ) : query.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Total giving</p><p className="mt-1 font-display text-xl font-semibold text-giving">{formatCurrency(query.data.amount, currency)}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Recorded gifts</p><p className="mt-1 font-display text-xl font-semibold tabular-nums">{query.data.gift_count}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {query.data.recipients.map((recipient) => (
                  <div key={recipient.recipient_id ?? "unassigned"} className="px-5 py-4 sm:px-6">
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <p className="font-medium">{recipient.recipient_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{recipient.gift_count} gift{recipient.gift_count === 1 ? "" : "s"}</p>
                      </div>
                      <p className="font-semibold tabular-nums text-giving">{formatCurrency(recipient.amount, currency)}</p>
                    </div>
                    <div className="mt-3 space-y-2 border-l-2 border-giving/20 pl-3">
                      {recipient.designations.map((designation) => (
                        <div key={designation.designation_id ?? designation.designation_name} className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-muted-foreground">{designation.designation_name} · {designation.gift_count}</span>
                          <span className="tabular-nums">{formatCurrency(designation.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
