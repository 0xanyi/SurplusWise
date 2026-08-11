"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { ApiStatementDraft, DebtType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deriveRate,
  getStatementResidual,
  isResidualSignificant,
} from "@/lib/debt-interest";

interface StatementDialogProps {
  debtId: string;
  debtType: DebtType;
  draft: ApiStatementDraft | null;
  /** Payments already recorded, used to preview the residual before saving. */
  payments: { amount: number; paid_at: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Closing a billing cycle. Everything derivable from the previous statement is
 * prefilled, so a credit card asks for three numbers: closing balance, interest,
 * and the minimum.
 */
export function StatementDialog({
  debtId,
  debtType,
  draft,
  payments,
  open,
  onOpenChange,
  onSaved,
}: StatementDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const isRevolving = debtType === "credit_card" || debtType === "overdraft";

  const [form, setForm] = useState(() => ({
    periodStart: draft?.period_start ?? "",
    periodEnd: today(),
    statementDate: today(),
    dueDate: "",
    openingBalance: draft ? String(draft.opening_balance) : "",
    closingBalance: "",
    interestCharged: "",
    feesCharged: "",
    newSpending: "",
    minimumPayment: draft?.suggested_minimum != null ? String(draft.suggested_minimum) : "",
    balanceSubjectToInterest: "",
    principalPaid: "",
    interestPaid: "",
    notes: "",
  }));

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  // Live preview of the two things the user cannot work out in their head:
  // what rate this cycle implies, and whether the figures add up.
  const preview = useMemo(() => {
    const opening = toNumber(form.openingBalance);
    const closing = toNumber(form.closingBalance);
    const interest = toNumber(form.interestCharged) ?? 0;
    const fees = toNumber(form.feesCharged) ?? 0;

    if (opening == null || closing == null || !form.periodStart || !form.periodEnd) {
      return null;
    }

    const paid = payments
      .filter((p) => p.paid_at >= form.periodStart && p.paid_at <= form.periodEnd)
      .reduce((sum, p) => sum + p.amount, 0);

    const residual = getStatementResidual({
      openingBalance: opening,
      closingBalance: closing,
      interestCharged: interest,
      feesCharged: fees,
      newSpending: toNumber(form.newSpending),
      paymentsInPeriod: paid,
    });

    return {
      rate: deriveRate({
        openingBalance: opening,
        closingBalance: closing,
        interestCharged: interest,
        balanceSubjectToInterest: toNumber(form.balanceSubjectToInterest),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      }),
      residual,
      residualSignificant: isResidualSignificant(residual, closing),
      paid,
    };
  }, [form, payments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const opening = toNumber(form.openingBalance);
    const closing = toNumber(form.closingBalance);
    if (opening == null || closing == null) {
      toast({
        title: "Error",
        description: "Opening and closing balance are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/debts-credits/${debtId}/statements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          statementDate: form.statementDate,
          dueDate: form.dueDate || null,
          openingBalance: opening,
          closingBalance: closing,
          interestCharged: toNumber(form.interestCharged) ?? 0,
          feesCharged: toNumber(form.feesCharged) ?? 0,
          newSpending: isRevolving ? toNumber(form.newSpending) : null,
          minimumPayment: isRevolving ? toNumber(form.minimumPayment) : null,
          balanceSubjectToInterest: toNumber(form.balanceSubjectToInterest),
          principalPaid: isRevolving ? null : toNumber(form.principalPaid),
          interestPaid: isRevolving ? null : toNumber(form.interestPaid),
          notes: form.notes || null,
        }),
      });

      toast({ title: "Success", description: "Statement recorded" });
      onOpenChange(false);
      onSaved();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save statement";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close statement</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="st-period-start">Period start</Label>
              <Input
                id="st-period-start"
                type="date"
                value={form.periodStart}
                onChange={(e) => set({ periodStart: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-period-end">Period end</Label>
              <Input
                id="st-period-end"
                type="date"
                value={form.periodEnd}
                onChange={(e) => set({ periodEnd: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="st-opening">Opening balance</Label>
              <Input
                id="st-opening"
                type="number"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) => set({ openingBalance: e.target.value })}
                required
              />
              {draft?.has_previous && (
                <p className="text-[11.5px] text-muted-foreground">
                  From the previous statement
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-closing">Closing balance</Label>
              <Input
                id="st-closing"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.closingBalance}
                onChange={(e) => set({ closingBalance: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="st-interest">Interest charged</Label>
              <Input
                id="st-interest"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.interestCharged}
                onChange={(e) => set({ interestCharged: e.target.value })}
              />
            </div>
            {isRevolving ? (
              <div className="space-y-2">
                <Label htmlFor="st-minimum">Minimum payment</Label>
                <Input
                  id="st-minimum"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.minimumPayment}
                  onChange={(e) => set({ minimumPayment: e.target.value })}
                />
                {draft?.suggested_minimum != null && (
                  <p className="text-[11.5px] text-muted-foreground">
                    Estimated from your rule
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="st-principal">Principal paid</Label>
                <Input
                  id="st-principal"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.principalPaid}
                  onChange={(e) => set({ principalPaid: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="st-due">Due date</Label>
              <Input
                id="st-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
            </div>
            {isRevolving && (
              <div className="space-y-2">
                <Label htmlFor="st-spending">New spending</Label>
                <Input
                  id="st-spending"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.newSpending}
                  onChange={(e) => set({ newSpending: e.target.value })}
                />
              </div>
            )}
          </div>

          {preview && (
            <div className="space-y-1.5 rounded-2xl border border-border/70 bg-sunken p-4">
              {preview.rate ? (
                <p className="text-[12.5px] tabular-nums">
                  <span className="text-muted-foreground">Rate this period </span>
                  <span className="font-semibold">
                    {preview.rate.periodRatePercent.toFixed(2)}%
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    over {preview.rate.periodDays} days ·{" "}
                    {preview.rate.annualisedPercent.toFixed(1)}% a year
                    {preview.rate.estimated && " (est.)"}
                  </span>
                </p>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  Rate needs a positive balance to calculate.
                </p>
              )}

              <p className="text-[12.5px] tabular-nums text-muted-foreground">
                {formatCurrency(preview.paid)} in payments recorded in this period
              </p>

              {preview.residualSignificant && (
                <p className="text-[12.5px] tabular-nums text-obligation">
                  {formatCurrency(Math.abs(preview.residual))} unexplained — a refund,
                  cashback, or a fee not entered. Saved either way.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {showMore ? "Fewer fields" : "More fields"}
          </button>

          {showMore && (
            <div className="space-y-4 border-t border-border/60 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="st-fees">Fees charged</Label>
                  <Input
                    id="st-fees"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.feesCharged}
                    onChange={(e) => set({ feesCharged: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="st-date">Statement date</Label>
                  <Input
                    id="st-date"
                    type="date"
                    value={form.statementDate}
                    onChange={(e) => set({ statementDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="st-basis">Balance subject to interest</Label>
                <Input
                  id="st-basis"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.balanceSubjectToInterest}
                  onChange={(e) => set({ balanceSubjectToInterest: e.target.value })}
                />
                <p className="text-[11.5px] text-muted-foreground">
                  If your statement prints this, the rate above becomes exact rather
                  than estimated. Issuers charge on an average daily balance, not the
                  closing figure.
                </p>
              </div>

              {!isRevolving && (
                <div className="space-y-2">
                  <Label htmlFor="st-interest-paid">Interest paid</Label>
                  <Input
                    id="st-interest-paid"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.interestPaid}
                    onChange={(e) => set({ interestPaid: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="st-notes">Notes</Label>
                <Input
                  id="st-notes"
                  placeholder="e.g. promotional rate ended"
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {saving ? "Saving..." : "Save statement"}
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
