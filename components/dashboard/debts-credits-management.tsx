"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Edit2,
  Trash2,
  CreditCard,
  Building2,
  CalendarDays,
  FileText,
  TrendingDown,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiDebtCredit, ApiFinancialAccount, DebtType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DebtFormFields,
  type DebtFormData,
} from "@/components/dashboard/debts/debt-form-fields";
import { EmptyState } from "@/components/dashboard/panel";

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit Card",
  loan: "Loan",
  mortgage: "Mortgage",
  overdraft: "Overdraft",
  other: "Other",
};

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

interface DebtsResponse {
  debts: ApiDebtCredit[];
  total_balance: number;
  total_min_payment: number;
  active_count: number;
}

function emptyForm(): DebtFormData {
  return {
    name: "",
    debtType: "credit_card",
    financialAccountId: "",
    lender: "",
    currentBalance: "",
    creditLimit: "",
    interestRate: "",
    minimumPayment: "",
    minPaymentPercent: "",
    minPaymentFloor: "",
    paymentDayOfMonth: "",
    startDate: "",
    endDate: "",
    notes: "",
  };
}

/**
 * Shared by the column head and every row so the two cannot drift apart.
 * Passed as a custom property rather than interpolated into the class name:
 * Tailwind scans source for literal class strings, so a built-up
 * `grid-cols-[...]` would never be compiled.
 */
const DEBT_COLUMNS = "minmax(0,1.4fr) minmax(0,1fr) 90px 100px 110px 88px";

export function DebtsCreditsManagement() {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<DebtsResponse>("/api/debts-credits");
  const { data: accountsData } = useApiQuery<{ accounts: ApiFinancialAccount[] }>(
    "/api/financial-accounts?includeInactive=true",
  );

  const debts = data?.debts;
  const liabilityAccounts = (accountsData?.accounts ?? []).filter(
    (account) => account.account_class === "liability",
  );
  const accountNames = new Map(
    liabilityAccounts.map((account) => [account.id, account.name]),
  );

  // Balance-weighted, so a large cheap loan does not get averaged away by a
  // small expensive card. Null when nothing carries a rate.
  const averageApr = useMemo(() => {
    const rated = (debts ?? []).filter(
      (d) => d.is_active && d.current_balance > 0 && d.interest_rate != null,
    );
    const balance = rated.reduce((sum, d) => sum + d.current_balance, 0);
    if (balance === 0) return null;
    return (
      rated.reduce((sum, d) => sum + d.current_balance * Number(d.interest_rate), 0) /
      balance
    );
  }, [debts]);

  /**
   * When the minimum payment clears the debt, at today's balances and rates.
   * Amortised month by month rather than balance/payment, because interest on
   * a 21.9% card eats a large share of a minimum payment. Null when the
   * minimums do not outrun the interest — there is no honest date to give.
   */
  const debtFreeBy = useMemo(() => {
    const active = (debts ?? []).filter(
      (d) => d.is_active && d.current_balance > 0 && (d.minimum_payment ?? 0) > 0,
    );
    if (active.length === 0) return null;

    let balances = active.map((d) => ({
      balance: d.current_balance,
      payment: d.minimum_payment!,
      monthlyRate: (Number(d.interest_rate ?? 0) / 100) / 12,
    }));

    for (let month = 1; month <= 600; month++) {
      balances = balances.map((b) => ({
        ...b,
        balance: b.balance * (1 + b.monthlyRate) - b.payment,
      }));
      if (balances.every((b) => b.balance <= 0)) {
        const date = new Date();
        date.setMonth(date.getMonth() + month);
        return date;
      }
      // A balance that grew this month will never be cleared by this payment.
      if (balances.some((b) => b.balance >= b.balance / (1 + b.monthlyRate))) {
        const stuck = balances.some(
          (b) => b.balance > 0 && b.balance * b.monthlyRate >= b.payment,
        );
        if (stuck) return null;
      }
    }
    return null;
  }, [debts]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiDebtCredit | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<DebtFormData>(() => emptyForm());

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingItem(null);
  };

  const buildPayload = () => {
    const currentBalance = Number.parseFloat(formData.currentBalance);
    if (Number.isNaN(currentBalance) || currentBalance < 0) return null;

    return {
      name: formData.name,
      debtType: formData.debtType,
      financialAccountId: formData.financialAccountId || null,
      lender: formData.lender || null,
      currentBalance,
      creditLimit: formData.creditLimit ? Number.parseFloat(formData.creditLimit) : null,
      interestRate: formData.interestRate ? Number.parseFloat(formData.interestRate) : null,
      minimumPayment: formData.minimumPayment ? Number.parseFloat(formData.minimumPayment) : null,
      minPaymentPercent: formData.minPaymentPercent
        ? Number.parseFloat(formData.minPaymentPercent)
        : null,
      minPaymentFloor: formData.minPaymentFloor
        ? Number.parseFloat(formData.minPaymentFloor)
        : null,
      paymentDayOfMonth: formData.paymentDayOfMonth
        ? Number.parseInt(formData.paymentDayOfMonth, 10)
        : null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      notes: formData.notes || null,
    };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      toast({ title: "Error", description: "Enter a valid balance", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/debts-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Debt/credit added" });
      setIsAddOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const payload = buildPayload();
    if (!payload) {
      toast({ title: "Error", description: "Enter a valid balance", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/debts-credits/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Debt/credit updated" });
      setIsEditOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ApiDebtCredit) => {
    if (!confirm(`Delete "${item.name}"? This will also remove all balance history.`)) return;
    try {
      await apiFetch(`/api/debts-credits/${item.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Debt/credit deleted" });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (item: ApiDebtCredit) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      debtType: item.debt_type,
      financialAccountId: item.financial_account_id ?? "",
      lender: item.lender ?? "",
      currentBalance: item.current_balance.toString(),
      creditLimit: item.credit_limit?.toString() ?? "",
      interestRate: item.interest_rate?.toString() ?? "",
      minimumPayment: item.minimum_payment?.toString() ?? "",
      minPaymentPercent: item.min_payment_percent?.toString() ?? "",
      minPaymentFloor: item.min_payment_floor?.toString() ?? "",
      paymentDayOfMonth: item.payment_day_of_month?.toString() ?? "",
      startDate: item.start_date ?? "",
      endDate: item.end_date ?? "",
      notes: item.notes ?? "",
    });
    setIsEditOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || debts === undefined) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load debts and credit accounts."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const selectableLiabilityAccounts = liabilityAccounts.filter(
    (account) => (
      account.id === formData.financialAccountId
      || !debts.some((debt) => debt.financial_account_id === account.id)
    ),
  );
  const formFields = (
    <DebtFormFields
      formData={formData}
      liabilityAccounts={selectableLiabilityAccounts}
      onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
    />
  );

  return (
    <div className="space-y-6">
      {/* Total owed — the page's anchor figure, on the obligation-toned hero.
          The slab is dark in both themes; globals.css keeps money tokens at
          their dark-mode values inside it. */}
      <div className="flex flex-wrap items-end justify-between gap-6 rounded-[20px] bg-hero-debt p-6 sm:px-[26px]">
        <div>
          <p className="text-[12.5px] text-obligation">Total owed</p>
          <p className="mt-1.5 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-hero-debt-ink sm:text-[44px]">
            {formatCurrency(data?.total_balance ?? 0)}
          </p>
          <p className="mt-2.5 text-[13px] text-hero-debt-muted tabular-nums">
            {formatCurrency(data?.total_min_payment ?? 0)} minimum due each month
            {debtFreeBy &&
              ` · debt-free by ${debtFreeBy.toLocaleDateString("en-GB", {
                month: "short",
                year: "numeric",
              })} at this rate`}
          </p>
        </div>
        <div className="flex gap-7">
          <div>
            <p className="text-[11.5px] text-hero-debt-muted">Active accounts</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-hero-debt-ink">
              {data?.active_count ?? 0}
            </p>
          </div>
          {averageApr !== null && (
            <div>
              <p className="text-[11.5px] text-hero-debt-muted">Avg. interest</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-hero-debt-ink">
                {averageApr.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add button + dialogs */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Debt / Credit
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Debt or Credit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {formFields}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Adding..." : "Add"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Debt / Credit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {formFields}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* One scannable table: account, type, APR, minimum, balance. The
          utilisation bar and balance history live in the expanded row, so the
          columns stay comparable down the page. */}
      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-card">
        {debts.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No debts tracked"
            description="Add a card or loan to see your balance sheet."
          />
        ) : (
          <>
            <div
              className="hidden gap-4 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground sm:grid sm:grid-cols-[var(--cols)] sm:px-6"
              style={{ "--cols": DEBT_COLUMNS } as React.CSSProperties}
            >
              <span>Account</span>
              <span>Type</span>
              <span className="text-right">APR</span>
              <span className="text-right">Min / mo</span>
              <span className="text-right">Balance</span>
              <span className="sr-only">Actions</span>
            </div>

            <ul>
              {debts.map((item) => {
                const expanded = expandedId === item.id;
                const utilisation =
                  item.credit_limit != null && item.credit_limit > 0
                    ? (item.current_balance / item.credit_limit) * 100
                    : null;

                return (
                  <li key={item.id} className="border-t border-border/60">
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[var(--cols)] sm:px-6"
                      style={{ "--cols": DEBT_COLUMNS } as React.CSSProperties}
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/debts/${item.id}`}
                          className="block truncate text-[13.5px] font-medium transition-colors hover:text-obligation"
                        >
                          {item.name}
                        </Link>
                        {(item.lender || item.financial_account_id) && (
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            {[item.lender, item.financial_account_id
                              ? `Linked to ${accountNames.get(item.financial_account_id) ?? "liability account"}`
                              : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>

                      <span className="hidden truncate text-[13px] text-muted-foreground sm:block">
                        {DEBT_TYPE_LABELS[item.debt_type]}
                      </span>
                      <span className="hidden text-right text-[13px] tabular-nums sm:block">
                        {item.interest_rate != null ? `${item.interest_rate}%` : "—"}
                      </span>
                      <span className="hidden text-right text-[13px] tabular-nums sm:block">
                        {item.minimum_payment != null
                          ? formatCurrency(item.minimum_payment)
                          : "—"}
                      </span>

                      <span className="text-right text-sm font-semibold text-obligation tabular-nums sm:col-auto">
                        {formatCurrency(item.current_balance)}
                      </span>

                      <span className="col-span-2 flex items-center justify-end gap-1 sm:col-auto">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`${expanded ? "Hide" : "Show"} balance history for ${item.name}`}
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                        >
                          {expanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <History className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>

                      {/* The columns hidden above sm, restated as a caption. */}
                      <p className="col-span-2 text-[11.5px] text-muted-foreground sm:hidden">
                        {DEBT_TYPE_LABELS[item.debt_type]}
                        {item.interest_rate != null && ` · ${item.interest_rate}% APR`}
                        {item.minimum_payment != null &&
                          ` · ${formatCurrency(item.minimum_payment)}/mo`}
                      </p>
                    </div>

                    {expanded && (
                      <div className="space-y-4 border-t border-border/60 bg-sunken px-5 py-4 sm:px-6">
                        {utilisation !== null && (
                          <div>
                            <div className="flex items-baseline justify-between text-[12.5px]">
                              <span className="tabular-nums text-muted-foreground">
                                Credit limit {formatCurrency(item.credit_limit!)}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {formatCurrency(
                                  Math.max(item.credit_limit! - item.current_balance, 0)
                                )}{" "}
                                available
                              </span>
                            </div>
                            {/* Low utilisation is neutral, not green: a small
                                balance is still a debt. */}
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  utilisation >= 90
                                    ? "bg-expense"
                                    : utilisation >= 70
                                    ? "bg-obligation"
                                    : "bg-foreground/70"
                                }`}
                                style={{ width: `${Math.min(utilisation, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {item.payment_day_of_month != null && (
                          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                            <CalendarDays className="size-3.5" />
                            Payment due {item.payment_day_of_month}
                            {getOrdinalSuffix(item.payment_day_of_month)} of each month
                          </p>
                        )}

                        <Link
                          href={`/dashboard/debts/${item.id}`}
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <FileText className="size-3.5" />
                          Statements, payments and balance history
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
