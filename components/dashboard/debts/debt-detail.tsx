"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { getUtilisation } from "@/lib/debt-interest";
import type {
  ApiDebtCredit,
  ApiDebtPayment,
  ApiDebtStatement,
  ApiStatementDraft,
  DebtType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SectionHeading, StatTile } from "@/components/dashboard/panel";
import { BalanceLogSection } from "@/components/dashboard/debts/balance-log-section";
import { StatementDialog } from "@/components/dashboard/debts/statement-dialog";

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit Card",
  loan: "Loan",
  mortgage: "Mortgage",
  overdraft: "Overdraft",
  other: "Other",
};

const STATEMENT_COLUMNS =
  "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr) 40px";

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

function formatPeriod(start: string, end: string) {
  const from = new Date(start);
  const to = new Date(end);
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromLabel = from.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const toLabel = to.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${fromLabel} – ${toLabel}`;
}

export function DebtDetail({ debtId }: { debtId: string }) {
  const { toast } = useToast();

  const debtQuery = useApiQuery<{ debt: ApiDebtCredit }>(`/api/debts-credits/${debtId}`);
  const statementsQuery = useApiQuery<{
    statements: ApiDebtStatement[];
    draft: ApiStatementDraft;
  }>(`/api/debts-credits/${debtId}/statements`);
  const paymentsQuery = useApiQuery<{ payments: ApiDebtPayment[] }>(
    `/api/debts-credits/${debtId}/payments`,
  );

  const [statementOpen, setStatementOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const debt = debtQuery.data?.debt;
  const statements = statementsQuery.data?.statements ?? [];
  const payments = paymentsQuery.data?.payments ?? [];

  const refreshAll = () => {
    debtQuery.refresh();
    statementsQuery.refresh();
    paymentsQuery.refresh();
  };

  if (debtQuery.loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (debtQuery.error || !debt) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={FileText}
            title="Debt not found"
            description={debtQuery.error ?? "It may have been deleted."}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/debts">Back to debts</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const utilisation = getUtilisation(debt.current_balance, debt.credit_limit);
  const latest = statements[0];

  // Interest is the cost of carrying this debt. It is not added to expenses
  // anywhere — the payment already is — so it only ever appears on its own line.
  const interestTotal = statements.reduce(
    (sum, s) => sum + s.interest_charged + s.fees_charged,
    0,
  );

  const ratedStatements = statements.filter((s) => s.rate !== null);
  const averageRate =
    ratedStatements.length > 0
      ? ratedStatements.reduce((sum, s) => sum + (s.rate?.annualised_percent ?? 0), 0) /
        ratedStatements.length
      : null;

  return (
    <>
      <div>
        <Link
          href="/dashboard/debts"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Debts &amp; credit
        </Link>
        <h1 className="mt-2 font-display text-[27px] font-semibold tracking-[-0.02em]">
          {debt.name}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {DEBT_TYPE_LABELS[debt.debt_type]}
          {debt.lender && ` · ${debt.lender}`}
          {debt.payment_day_of_month != null &&
            ` · pays on the ${debt.payment_day_of_month}${ordinal(debt.payment_day_of_month)}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile
          label="Balance"
          value={formatCurrency(debt.current_balance)}
          tone="text-obligation"
        />
        <StatTile
          label={debt.credit_limit != null ? "Utilisation" : "Credit limit"}
          value={
            utilisation != null
              ? `${Math.round(utilisation)}%`
              : debt.credit_limit != null
                ? formatCurrency(debt.credit_limit)
                : "—"
          }
          note={
            debt.credit_limit != null
              ? `of ${formatCurrency(debt.credit_limit)}`
              : undefined
          }
        />
        <StatTile
          label="APR as advertised"
          value={debt.interest_rate != null ? `${debt.interest_rate}%` : "—"}
          note={
            latest?.rate
              ? `${latest.rate.annualised_percent.toFixed(1)}% implied last cycle`
              : undefined
          }
        />
        <StatTile
          label="Cost of borrowing"
          value={formatCurrency(interestTotal)}
          note={
            averageRate != null
              ? `${averageRate.toFixed(1)}% average`
              : "No statements yet"
          }
        />
      </div>

      <div>
        <SectionHeading
          title="Statements"
          aside={
            statements.length > 0
              ? `${statements.length} recorded`
              : undefined
          }
        />
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3.5">
            <CardTitle>Billing cycles</CardTitle>
            <Button size="sm" onClick={() => setStatementOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              Close statement
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {statementsQuery.loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : statements.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No statements recorded"
                description="Record a billing cycle to see the interest charged and the rate it implies."
              />
            ) : (
              <>
                <div
                  className="hidden gap-x-4 border-t border-border/60 px-5 py-2.5 text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground sm:grid sm:px-6"
                  style={{ gridTemplateColumns: STATEMENT_COLUMNS }}
                >
                  <span>Period</span>
                  <span className="text-right">Closing</span>
                  <span className="text-right">Interest</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">Minimum</span>
                  <span />
                </div>

                <ul>
                  {statements.map((statement) => (
                    <li key={statement.id}>
                      <div
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-border/60 px-5 py-3.5 sm:px-6"
                        style={{ gridTemplateColumns: undefined }}
                      >
                        <div
                          className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[var(--cols)]"
                          style={
                            { "--cols": STATEMENT_COLUMNS } as React.CSSProperties
                          }
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium">
                              {formatPeriod(statement.period_start, statement.period_end)}
                            </p>
                            {statement.due_date && (
                              <p className="truncate text-[11.5px] text-muted-foreground">
                                Due{" "}
                                {new Date(statement.due_date).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </p>
                            )}
                          </div>

                          <span className="text-right text-sm font-semibold tabular-nums text-obligation sm:col-auto">
                            {formatCurrency(statement.closing_balance)}
                          </span>

                          <span className="hidden text-right text-[13px] tabular-nums sm:block">
                            {statement.interest_charged > 0
                              ? formatCurrency(statement.interest_charged)
                              : "—"}
                          </span>

                          <span className="hidden text-right text-[13px] tabular-nums sm:block">
                            {statement.rate ? (
                              <>
                                {statement.rate.period_rate_percent.toFixed(2)}%
                                <span className="ml-1 text-[11px] text-muted-foreground">
                                  {statement.rate.estimated ? "est." : "exact"}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </span>

                          <span className="hidden text-right text-[13px] tabular-nums sm:block">
                            {statement.minimum_payment != null
                              ? formatCurrency(statement.minimum_payment)
                              : "—"}
                          </span>

                          <span className="col-span-2 flex justify-end sm:col-auto">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label={`Delete statement for ${formatPeriod(statement.period_start, statement.period_end)}`}
                              onClick={async () => {
                                if (!confirm("Delete this statement?")) return;
                                try {
                                  await apiFetch(
                                    `/api/debts-credits/${debtId}/statements/${statement.id}`,
                                    { method: "DELETE" },
                                  );
                                  toast({ title: "Deleted", description: "Statement removed" });
                                  refreshAll();
                                } catch (error: unknown) {
                                  toast({
                                    title: "Error",
                                    description:
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to delete",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </span>
                        </div>

                        {/* Columns hidden above sm, restated so nothing is lost. */}
                        <p className="col-span-2 text-[11.5px] tabular-nums text-muted-foreground sm:hidden">
                          {statement.interest_charged > 0
                            ? `${formatCurrency(statement.interest_charged)} interest`
                            : "No interest"}
                          {statement.rate &&
                            ` · ${statement.rate.period_rate_percent.toFixed(2)}% ${
                              statement.rate.estimated ? "est." : "exact"
                            }`}
                          {statement.minimum_payment != null &&
                            ` · ${formatCurrency(statement.minimum_payment)} min`}
                        </p>

                        {statement.rate && statement.advertised_apr != null && (
                          <p className="col-span-2 text-[11.5px] tabular-nums text-muted-foreground">
                            {statement.rate.annualised_percent.toFixed(1)}% a year against{" "}
                            {statement.advertised_apr}% on file
                            {Math.abs(
                              statement.rate.annualised_percent - statement.advertised_apr,
                            ) >= 1 && (
                              <span className="ml-1 text-obligation">
                                (
                                {statement.rate.annualised_percent >
                                statement.advertised_apr
                                  ? "+"
                                  : ""}
                                {(
                                  statement.rate.annualised_percent -
                                  statement.advertised_apr
                                ).toFixed(1)}
                                pts)
                              </span>
                            )}
                          </p>
                        )}

                        {statement.residual_significant && (
                          <p className="col-span-2 text-[11.5px] tabular-nums text-obligation">
                            {formatCurrency(Math.abs(statement.residual))} unexplained
                            against the figures recorded
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <div>
          <SectionHeading title="Payments" />
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3.5">
              <CardTitle>What you have paid</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
                <Plus className="mr-1.5 size-3.5" />
                Record
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No payments recorded"
                  description="Payments count as expenses in your reports."
                />
              ) : (
                <ul>
                  {payments.slice(0, 8).map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center gap-3.5 border-t border-border/60 px-5 py-3 sm:px-6"
                    >
                      <CalendarDays className="size-3.5 flex-none text-muted-foreground" />
                      <span className="flex-1 text-[12.5px] text-muted-foreground tabular-nums">
                        {new Date(payment.paid_at).toLocaleDateString("en-GB")}
                        {payment.notes && (
                          <span className="ml-2 text-foreground">{payment.notes}</span>
                        )}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(payment.amount)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive"
                        aria-label={`Delete payment of ${formatCurrency(payment.amount)}`}
                        onClick={async () => {
                          try {
                            await apiFetch(
                              `/api/debts-credits/${debtId}/payments/${payment.id}`,
                              { method: "DELETE" },
                            );
                            toast({ title: "Deleted", description: "Payment removed" });
                            refreshAll();
                          } catch (error: unknown) {
                            toast({
                              title: "Error",
                              description:
                                error instanceof Error ? error.message : "Failed to delete",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <SectionHeading title="Balance history" />
          <Card>
            <CardContent className="pt-5">
              <BalanceLogSection debtId={debtId} onChanged={refreshAll} />
            </CardContent>
          </Card>
        </div>
      </div>

      {statementOpen && (
        <StatementDialog
          debtId={debtId}
          debtType={debt.debt_type}
          draft={statementsQuery.data?.draft ?? null}
          payments={payments}
          open={statementOpen}
          onOpenChange={setStatementOpen}
          onSaved={refreshAll}
        />
      )}

      <PaymentDialog
        debtId={debtId}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSaved={refreshAll}
      />
    </>
  );
}

function PaymentDialog({
  debtId,
  open,
  onOpenChange,
  onSaved,
}: {
  debtId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast({
        title: "Error",
        description: "Enter a payment amount",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/debts-credits/${debtId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, paidAt, notes: notes || null }),
      });
      toast({ title: "Success", description: "Payment recorded" });
      setAmount("");
      setNotes("");
      onOpenChange(false);
      onSaved();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-date">Date paid</Label>
            <Input
              id="pay-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-notes">Notes (optional)</Label>
            <Input
              id="pay-notes"
              placeholder="e.g. cleared the statement"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving..." : "Record payment"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
