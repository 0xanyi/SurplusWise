"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileWarning, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiQuery, useWorkspaceCurrency } from "@/hooks/use-api";
import { TRANSACTION_CHANGED_EVENT } from "@/lib/client-events";
import { formatCurrency } from "@/lib/utils";
import type { ApiGivingDocumentReviewTransaction } from "@/types";
import { GivingSupportingDocuments } from "./giving-supporting-documents";

interface ReviewResponse {
  period_start: string;
  period_end: string;
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  transactions: ApiGivingDocumentReviewTransaction[];
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GivingDocumentReview() {
  const currency = useWorkspaceCurrency();
  const [initialRange] = useState(currentYearRange);
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [page, setPage] = useState(0);
  const [selectedTransaction, setSelectedTransaction] =
    useState<ApiGivingDocumentReviewTransaction | null>(null);
  const query = useApiQuery<ReviewResponse>(
    `/api/giving-document-review?startDate=${appliedRange.start}&endDate=${appliedRange.end}&page=${page}`,
  );
  const refresh = query.refresh;

  useEffect(() => {
    window.addEventListener(TRANSACTION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TRANSACTION_CHANGED_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    if (!query.loading && page > 0 && query.data?.transactions.length === 0) {
      setPage((current) => Math.max(0, current - 1));
    }
  }, [page, query.data?.transactions.length, query.loading]);

  const applyRange = () => {
    setPage(0);
    setAppliedRange({ start: periodStart, end: periodEnd });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Supporting document review</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Find recorded gifts with no receipt, acknowledgement, or payment evidence attached.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="document-review-start" className="text-xs">From</Label>
            <Input id="document-review-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <Label htmlFor="document-review-end" className="text-xs">To</Label>
            <Input id="document-review-end" type="date" value={periodEnd} min={periodStart} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1 h-9" />
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!periodStart || !periodEnd || periodEnd < periodStart} onClick={applyRange}>Apply</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {query.loading ? (
            <p className="p-6 text-sm text-muted-foreground">Checking supporting documents...</p>
          ) : query.error ? (
            <p className="p-6 text-sm text-destructive">{query.error}</p>
          ) : query.data?.total === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-giving-surface">
                <CheckCircle2 className="size-5 text-giving" />
              </div>
              <p className="font-medium">All gifts have supporting documents</p>
              <p className="mt-1 text-sm text-muted-foreground">Nothing is missing in this period.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
                <div className="flex size-9 items-center justify-center rounded-xl bg-obligation-surface">
                  <FileWarning className="size-4 text-obligation" />
                </div>
                <div>
                  <p className="font-medium tabular-nums">{query.data?.total} gift{query.data?.total === 1 ? "" : "s"} missing documents</p>
                  <p className="text-xs text-muted-foreground">These are personal record reminders, not official tax receipt requirements.</p>
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {query.data?.transactions.map((transaction) => (
                  <div key={transaction.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{transaction.payee || transaction.giving_recipient_name || transaction.category}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {[
                          displayDate(transaction.date),
                          transaction.giving_recipient_name,
                          transaction.giving_designation_name || (transaction.giving_recipient_name ? "General" : null),
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-giving">{formatCurrency(transaction.amount, currency)}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedTransaction(transaction)}>
                      <Paperclip className="size-4" /> Attach document
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border/60 bg-sunken px-5 py-3 sm:px-6">
                <span className="text-xs text-muted-foreground tabular-nums">Page {(query.data?.page ?? 0) + 1}</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!query.data?.has_more} onClick={() => setPage((current) => current + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTransaction(null);
            query.refresh();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supporting documents</DialogTitle>
            <DialogDescription>
              Attach a receipt, acknowledgement, or payment evidence to this recorded gift.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <GivingSupportingDocuments transactionId={selectedTransaction.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
