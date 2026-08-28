"use client";

import { useMemo, useState } from "react";
import { Plus, Edit2, Trash2, TrendingUp, CopyPlus } from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiBudget, TransactionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  getCurrentBudgetRange,
  getNextBudgetRange,
} from "@/lib/budget-periods";
import { incomeProjectionCopy } from "@/lib/projected-income";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

const formatBudgetDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function ProjectedIncomeManagement() {
  const { toast } = useToast();
  const {
    data: budgetData,
    loading: budgetsLoading,
    refresh: refreshBudgets,
  } = useApiQuery<{ budgets: ApiBudget[] }>("/api/budgets");
  const { data: catData, loading: categoriesLoading } = useApiQuery<{
    categories: ApiCategory[];
  }>("/api/categories");

  const budgets = budgetData?.budgets;
  const categories = catData?.categories;

  const projections = useMemo(
    () => (budgets ?? []).filter((budget) => budget.type === "income"),
    [budgets],
  );
  const incomeCategories = useMemo(
    () => (categories ?? []).filter((category) => category.type === "income"),
    [categories],
  );

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyingBudgetId, setCopyingBudgetId] = useState<string | null>(null);
  const [copyingBudget, setCopyingBudget] = useState<ApiBudget | null>(null);
  const [editingBudget, setEditingBudget] = useState<ApiBudget | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    period: "monthly" as BudgetPeriod,
  });

  const resetForm = () => {
    setFormData({ category: "", amount: "", period: "monthly" });
    setEditingBudget(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Enter a valid amount",
        variant: "destructive",
      });
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
          type: "income",
        }),
      });

      toast({ title: "Success", description: "Projected income created" });
      setIsAddDialogOpen(false);
      resetForm();
      refreshBudgets();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create projected income";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;

    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/budgets/${editingBudget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      toast({ title: "Success", description: "Projected income updated" });
      setIsEditDialogOpen(false);
      resetForm();
      refreshBudgets();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update projected income";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (budget: ApiBudget) => {
    if (!confirm(`Delete projected income for "${budget.category}"?`)) return;

    try {
      await apiFetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Projected income deleted" });
      refreshBudgets();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete projected income";
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
        body: JSON.stringify({ carryRemaining: false }),
      });
      toast({
        title: "Success",
        description: "Projection copied to the next period",
      });
      setCopyingBudget(null);
      refreshBudgets();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to copy projected income";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCopyingBudgetId(null);
    }
  };

  const openEditDialog = (budget: ApiBudget) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
    });
    setIsEditDialogOpen(true);
  };

  if (
    budgetsLoading ||
    categoriesLoading ||
    budgets === undefined ||
    categories === undefined
  ) {
    return <p className="text-sm text-muted-foreground">Loading projected income...</p>;
  }

  return (
    <div className="space-y-6">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add projected income
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project income</DialogTitle>
            <DialogDescription>
              Set what you expect to receive in the current period. Recorded
              income in this category is compared against it.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projected-income-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger
                  id="projected-income-category"
                  aria-label="Income category"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {incomeCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projected-income-amount">Expected amount</Label>
              <Input
                id="projected-income-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projected-income-period">Period</Label>
              <Select
                value={formData.period}
                onValueChange={(value: BudgetPeriod) =>
                  setFormData((prev) => ({ ...prev, period: value }))
                }
              >
                <SelectTrigger
                  id="projected-income-period"
                  aria-label="Projection period"
                >
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
              <Button
                type="submit"
                className="flex-1"
                disabled={saving || !formData.category}
              >
                {saving ? "Creating..." : "Create projection"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit projected income</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={formData.category} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-projected-income-amount">Expected amount</Label>
              <Input
                id="edit-projected-income-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
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
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy projection to next period</DialogTitle>
            {copyingBudget && (
              <DialogDescription>
                {formatBudgetDate(
                  getNextBudgetRange(copyingBudget.end_date, copyingBudget.period)
                    .startDate,
                )}{" "}
                –{" "}
                {formatBudgetDate(
                  getNextBudgetRange(copyingBudget.end_date, copyingBudget.period)
                    .endDate,
                )}
              </DialogDescription>
            )}
          </DialogHeader>

          {copyingBudget && (
            <form onSubmit={handleCopyForward} className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(copyingBudget.amount)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                The current period will be archived so its received history
                remains unchanged.
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
                  {copyingBudgetId ? "Copying..." : "Copy projection"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projections.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No projected income yet</p>
              <p className="mt-1 text-sm">
                Add what you expect to receive this month in this workspace.
              </p>
            </CardContent>
          </Card>
        ) : (
          projections.map((budget) => {
            const outstanding = budget.amount - budget.spent;
            const note = incomeProjectionCopy(outstanding, formatCurrency);

            return (
              <Card key={budget.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-income-surface p-2">
                        <TrendingUp className="size-4 text-income" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{budget.category}</CardTitle>
                        <p className="text-xs capitalize text-muted-foreground">
                          {budget.period}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBudgetDate(budget.start_date)} –{" "}
                          {formatBudgetDate(budget.end_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Copy ${budget.category} projection to the next period`}
                        disabled={copyingBudgetId !== null}
                        onClick={() => setCopyingBudget(budget)}
                      >
                        <CopyPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Edit ${budget.category} projected income`}
                        onClick={() => openEditDialog(budget)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete ${budget.category} projected income`}
                        onClick={() => handleDelete(budget)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Received</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(budget.spent)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Expected</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(budget.amount)}
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={Math.min(Math.round(budget.percentage), 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${budget.category} income received`}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-track"
                  >
                    <div
                      className="h-full rounded-full bg-income transition-all duration-500"
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{note}</span>
                    <span className="tabular-nums text-income">
                      {Math.round(budget.percentage)}%
                    </span>
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
