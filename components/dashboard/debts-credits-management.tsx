"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  CreditCard,
  Building2,
  CalendarDays,
  TrendingDown,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiDebtCredit, DebtType } from "@/types";
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
import { BalanceLogSection } from "@/components/dashboard/debts/balance-log-section";

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

export function DebtsCreditsManagement() {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<DebtsResponse>("/api/debts-credits");

  const debts = data?.debts;

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

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiDebtCredit | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<DebtFormData>({
    name: "",
    debtType: "credit_card" as DebtType,
    lender: "",
    currentBalance: "",
    creditLimit: "",
    interestRate: "",
    minimumPayment: "",
    paymentDayOfMonth: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      debtType: "credit_card",
      lender: "",
      currentBalance: "",
      creditLimit: "",
      interestRate: "",
      minimumPayment: "",
      paymentDayOfMonth: "",
      startDate: "",
      endDate: "",
      notes: "",
    });
    setEditingItem(null);
  };

  const buildPayload = () => {
    const currentBalance = Number.parseFloat(formData.currentBalance);
    if (Number.isNaN(currentBalance) || currentBalance < 0) return null;

    return {
      name: formData.name,
      debtType: formData.debtType,
      lender: formData.lender || null,
      currentBalance,
      creditLimit: formData.creditLimit ? Number.parseFloat(formData.creditLimit) : null,
      interestRate: formData.interestRate ? Number.parseFloat(formData.interestRate) : null,
      minimumPayment: formData.minimumPayment ? Number.parseFloat(formData.minimumPayment) : null,
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
      lender: item.lender ?? "",
      currentBalance: item.current_balance.toString(),
      creditLimit: item.credit_limit?.toString() ?? "",
      interestRate: item.interest_rate?.toString() ?? "",
      minimumPayment: item.minimum_payment?.toString() ?? "",
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

  const formFields = (
    <DebtFormFields
      formData={formData}
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
          <p className="mt-2.5 text-[13px] text-hero-debt-muted">
            {formatCurrency(data?.total_min_payment ?? 0)} minimum due each month
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

      {/* Debts list */}
      <div className="grid gap-4 md:grid-cols-2">
        {debts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No debts or credit accounts</p>
              <p className="text-sm mt-1">Add credit cards, loans, or other debts to track them.</p>
            </CardContent>
          </Card>
        ) : (
          debts.map((item) => (
            <Card key={item.id} className={!item.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-obligation-surface p-2">
                      {item.debt_type === "credit_card" ? (
                        <CreditCard className="size-4 text-obligation" />
                      ) : item.debt_type === "mortgage" ? (
                        <Building2 className="size-4 text-obligation" />
                      ) : (
                        <TrendingDown className="size-4 text-obligation" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {DEBT_TYPE_LABELS[item.debt_type]}
                        {item.lender && ` · ${item.lender}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => openEditDialog(item)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-semibold tabular-nums text-obligation">
                    {formatCurrency(item.current_balance)}
                  </span>
                </div>

                {item.debt_type === "credit_card" && item.credit_limit != null && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Credit Limit</span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(item.credit_limit)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-track">
                      {/* Low utilisation is neutral, not green: a small balance
                          is still a debt, and green means giving. */}
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (item.current_balance / item.credit_limit) * 100 >= 90
                            ? "bg-expense"
                            : (item.current_balance / item.credit_limit) * 100 >= 70
                            ? "bg-obligation"
                            : "bg-foreground/70"
                        }`}
                        style={{
                          width: `${Math.min(
                            (item.current_balance / item.credit_limit) * 100,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        Math.max(item.credit_limit - item.current_balance, 0),
                      )}{" "}
                      available
                    </p>
                  </>
                )}

                {item.minimum_payment != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Min. Payment</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(item.minimum_payment)}
                    </span>
                  </div>
                )}

                {item.payment_day_of_month != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      Payment due
                    </span>
                    <span className="font-medium">
                      {item.payment_day_of_month}
                      {getOrdinalSuffix(item.payment_day_of_month)} of each month
                    </span>
                  </div>
                )}

                {item.interest_rate != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">APR</span>
                    <span className="font-medium tabular-nums">{item.interest_rate}%</span>
                  </div>
                )}

                {/* Expand/collapse balance history */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground mt-2"
                  onClick={() =>
                    setExpandedId(expandedId === item.id ? null : item.id)
                  }
                >
                  <History className="size-3 mr-1" />
                  {expandedId === item.id ? "Hide" : "Show"} Balance History
                  {expandedId === item.id ? (
                    <ChevronUp className="size-3 ml-1" />
                  ) : (
                    <ChevronDown className="size-3 ml-1" />
                  )}
                </Button>

                {expandedId === item.id && (
                  <BalanceLogSection debtId={item.id} onChanged={refresh} />
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
