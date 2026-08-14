"use client";

import { useMemo, useState } from "react";
import { Plus, Edit2, Trash2, TrendingDown, TrendingUp, AlertTriangle, CopyPlus, WalletCards } from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ApiBudget, TransactionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  getCurrentBudgetRange,
  getNextBudgetRange,
  getRolledBudgetAmount,
} from "@/lib/budget-periods";
import { getMonthlyEnvelopePlan } from "@/lib/envelope-budgeting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BudgetType = "expense" | "giving" | "income";
type BudgetPeriod = "monthly" | "quarterly" | "yearly";

interface ApiCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string | null;
  is_default: boolean;
  created_at: string | null;
}

const getBudgetStatus = (percentage: number) => {
  if (percentage >= 100) return "exceeded" as const;
  if (percentage >= 80) return "warning" as const;
  return "ok" as const;
};

const formatBudgetDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function BudgetManagement() {
  const { toast } = useToast();
  const { activeWorkspace, updateWorkspace } = useWorkspace();
  const {
    data: budgetData,
    loading: budgetsLoading,
    refresh: refreshBudgets,
  } = useApiQuery<{ budgets: ApiBudget[] }>("/api/budgets");
  const { data: catData, loading: categoriesLoading } = useApiQuery<{ categories: ApiCategory[] }>("/api/categories");

  const budgets = budgetData?.budgets;
  const categories = catData?.categories;

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEnvelopeMode, setSavingEnvelopeMode] = useState(false);
  const [copyingBudgetId, setCopyingBudgetId] = useState<string | null>(null);
  const [copyingBudget, setCopyingBudget] = useState<ApiBudget | null>(null);
  const [carryRemaining, setCarryRemaining] = useState(false);
  const [editingBudget, setEditingBudget] = useState<ApiBudget | null>(null);

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    period: "monthly" as BudgetPeriod,
    type: "expense" as BudgetType,
  });

  const filteredCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === formData.type),
    [categories, formData.type]
  );

  const monthlyEnvelopePlan = useMemo(
    () => getMonthlyEnvelopePlan(budgets ?? [], getCurrentBudgetRange("monthly")),
    [budgets],
  );

  const resetForm = () => {
    setFormData({ category: "", amount: "", period: "monthly", type: "expense" });
    setEditingBudget(null);
  };

  const handleEnvelopeModeChange = async (enabled: boolean) => {
    if (!activeWorkspace) return;
    setSavingEnvelopeMode(true);
    try {
      await updateWorkspace(activeWorkspace.id, { envelope_budgeting_enabled: enabled });
      toast({
        title: enabled ? "Envelope budgeting enabled" : "Envelope budgeting disabled",
        description: enabled
          ? "Monthly budgets now show how expected income is assigned"
          : "Your category budgets are unchanged",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update envelope budgeting",
        variant: "destructive",
      });
    } finally {
      setSavingEnvelopeMode(false);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { startDate, endDate } = getCurrentBudgetRange(formData.period);
      await apiFetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.category,
          amount,
          period: formData.period,
          startDate,
          endDate,
          type: formData.type,
        }),
      });

      toast({ title: "Success", description: "Budget created" });
      setIsAddDialogOpen(false);
      resetForm();
      refreshBudgets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;

    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/budgets/${editingBudget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      toast({ title: "Success", description: "Budget updated" });
      setIsEditDialogOpen(false);
      resetForm();
      refreshBudgets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budget: ApiBudget) => {
    if (!confirm(`Delete budget for "${budget.category}"?`)) return;

    try {
      await apiFetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Budget deleted" });
      refreshBudgets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleCopyForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyingBudget) return;

    setCopyingBudgetId(copyingBudget.id);
    try {
      await apiFetch(`/api/budgets/${copyingBudget.id}/copy-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carryRemaining }),
      });
      toast({ title: "Success", description: "Budget copied to the next period" });
      setCopyingBudget(null);
      setCarryRemaining(false);
      refreshBudgets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to copy budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCopyingBudgetId(null);
    }
  };

  const openCopyDialog = (budget: ApiBudget) => {
    setCopyingBudget(budget);
    setCarryRemaining(false);
  };

  const openEditDialog = (budget: ApiBudget) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
      type: budget.type,
    });
    setIsEditDialogOpen(true);
  };

  if (budgetsLoading || categoriesLoading || budgets === undefined || categories === undefined) {
    return <p className="text-sm text-muted-foreground">Loading budgets...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="rounded-xl bg-muted p-2.5">
                <WalletCards className="size-4" />
              </div>
              <div>
                <Label htmlFor="envelope-budgeting" className="text-sm font-semibold">
                  Monthly envelope budgeting
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assign expected monthly income across expense and giving category budgets.
                </p>
              </div>
            </div>
            <Switch
              id="envelope-budgeting"
              checked={activeWorkspace?.envelope_budgeting_enabled ?? false}
              disabled={!activeWorkspace || savingEnvelopeMode}
              onCheckedChange={handleEnvelopeModeChange}
            />
          </div>

          {activeWorkspace?.envelope_budgeting_enabled && (
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Expected income</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatCurrency(monthlyEnvelopePlan.expectedIncome)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Expense envelopes</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {formatCurrency(monthlyEnvelopePlan.expenses)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Giving envelopes</p>
                  <p className="mt-1 font-semibold tabular-nums text-giving">
                    {formatCurrency(monthlyEnvelopePlan.giving)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    {monthlyEnvelopePlan.unassigned < 0 ? "Over-assigned" : "Unassigned"}
                  </p>
                  <p
                    className={`mt-1 font-semibold tabular-nums ${
                      monthlyEnvelopePlan.unassigned < 0 ? "text-expense" : ""
                    }`}
                  >
                    {formatCurrency(Math.abs(monthlyEnvelopePlan.unassigned))}
                  </p>
                </div>
              </div>
              {monthlyEnvelopePlan.expectedIncome === 0 ? (
                <p className="text-xs text-obligation">
                  Add a monthly income budget to define how much is available to assign.
                </p>
              ) : monthlyEnvelopePlan.unassigned === 0 ? (
                <p className="text-xs font-medium">Every unit of expected income is assigned.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {monthlyEnvelopePlan.unassigned > 0
                    ? `${formatCurrency(monthlyEnvelopePlan.unassigned)} is still available to assign.`
                    : `Reduce monthly envelopes by ${formatCurrency(Math.abs(monthlyEnvelopePlan.unassigned))} to match expected income.`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Budget</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddBudget} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget-type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: BudgetType) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: value,
                    category: "",
                  }))
                }
              >
                <SelectTrigger id="budget-type" aria-label="Budget type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="giving">Giving</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="budget-category" aria-label="Budget category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-amount">Amount</Label>
              <Input
                id="budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-period">Period</Label>
              <Select
                value={formData.period}
                onValueChange={(value: BudgetPeriod) => setFormData((prev) => ({ ...prev, period: value }))}
              >
                <SelectTrigger id="budget-period" aria-label="Budget period">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Creating..." : "Create Budget"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditBudget} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={formData.category} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-budget-amount">Amount</Label>
              <Input
                id="edit-budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={copyingBudget !== null}
        onOpenChange={(open) => {
          if (!open && copyingBudgetId === null) {
            setCopyingBudget(null);
            setCarryRemaining(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy budget to next period</DialogTitle>
            {copyingBudget && (
              <DialogDescription>
                {formatBudgetDate(getNextBudgetRange(copyingBudget.end_date, copyingBudget.period).startDate)} –{" "}
                {formatBudgetDate(getNextBudgetRange(copyingBudget.end_date, copyingBudget.period).endDate)}
              </DialogDescription>
            )}
          </DialogHeader>

          {copyingBudget && (
            <form onSubmit={handleCopyForward} className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base budget</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(copyingBudget.amount)}</span>
                </div>
                {carryRemaining && copyingBudget.remaining > 0 && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Unused balance</span>
                    <span className="font-semibold tabular-nums">+{formatCurrency(copyingBudget.remaining)}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                  <span>Next budget</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(
                      carryRemaining
                        ? getRolledBudgetAmount(copyingBudget.amount, copyingBudget.remaining)
                        : copyingBudget.amount,
                    )}
                  </span>
                </div>
              </div>

              {copyingBudget.type !== "income" && copyingBudget.remaining > 0 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-4">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-foreground"
                    checked={carryRemaining}
                    onChange={(event) => setCarryRemaining(event.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium">Carry unused balance forward</span>
                    <span className="block text-xs text-muted-foreground">
                      Add {formatCurrency(copyingBudget.remaining)} left in this period to the next budget.
                    </span>
                  </span>
                </label>
              )}

              <p className="text-xs text-muted-foreground">
                The current period will be archived so its spending history remains unchanged.
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={copyingBudgetId !== null}
                  onClick={() => setCopyingBudget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={copyingBudgetId !== null}>
                  {copyingBudgetId ? "Copying..." : "Copy Budget"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {budgets.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No budgets yet</p>
              <p className="text-sm mt-1">Create one to track your progress.</p>
            </CardContent>
          </Card>
        ) : (
          budgets.map((budget) => {
            const status = getBudgetStatus(budget.percentage);
            return (
              <Card key={budget.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2 ${budget.type === "expense" ? "bg-expense-surface" : budget.type === "income" ? "bg-income-surface" : "bg-giving-surface"}`}>
                        {budget.type === "expense" ? (
                          <TrendingDown className="size-4 text-expense" />
                        ) : (
                          <TrendingUp className={`size-4 ${budget.type === "income" ? "text-income" : "text-giving"}`} />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{budget.category}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">
                          {budget.period} {budget.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBudgetDate(budget.start_date)} – {formatBudgetDate(budget.end_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Copy ${budget.category} budget to the next period`}
                        disabled={copyingBudgetId !== null}
                        onClick={() => openCopyDialog(budget)}
                      >
                        <CopyPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Edit ${budget.category} budget`} onClick={() => openEditDialog(budget)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete ${budget.category} budget`}
                        onClick={() => handleDeleteBudget(budget)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(budget.spent)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(budget.amount)}</span>
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={Math.min(Math.round(budget.percentage), 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${budget.category} budget used`}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-track"
                  >
                    {/* Healthy is neutral ink — see the Giving-Is-Not-Green-Money
                        rule in DESIGN.md. */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        status === "exceeded"
                          ? "bg-expense"
                          : status === "warning"
                          ? "bg-obligation"
                          : "bg-foreground/70"
                      }`}
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {budget.remaining >= 0
                        ? `${formatCurrency(budget.remaining)} remaining`
                        : `${formatCurrency(Math.abs(budget.remaining))} over budget`}
                    </span>
                    {(status === "warning" || status === "exceeded") && (
                      <span className={`inline-flex items-center gap-1 ${status === "exceeded" ? "text-expense" : "text-obligation"}`}>
                        <AlertTriangle className="h-3 w-3" />
                        {status === "exceeded" ? "Over" : "Near limit"}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
