"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Edit2, Trash2, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BudgetType = "expense" | "giving" | "income";
type BudgetPeriod = "monthly" | "quarterly" | "yearly";

interface BudgetRow {
  _id: Id<"budgets">;
  category: string;
  amount: number;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  type: BudgetType;
  spent: number;
  remaining: number;
  percentUsed: number;
}

const getBudgetStatus = (percentage: number) => {
  if (percentage >= 100) return "exceeded" as const;
  if (percentage >= 80) return "warning" as const;
  return "ok" as const;
};

export function BudgetManagement() {
  const { toast } = useToast();
  const budgets = useQuery(api.budgets.getWithSpending, {}) as BudgetRow[] | undefined;
  const categories = useQuery(api.categories.list, {});
  const createBudget = useMutation(api.budgets.create);
  const updateBudget = useMutation(api.budgets.update);
  const removeBudget = useMutation(api.budgets.remove);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);

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

  const calculateDateRange = (period: BudgetPeriod) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end: Date;

    switch (period) {
      case "monthly":
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarterly": {
        const quarter = Math.floor(now.getMonth() / 3);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      }
      case "yearly":
        end = new Date(now.getFullYear(), 11, 31);
        break;
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  };

  const resetForm = () => {
    setFormData({ category: "", amount: "", period: "monthly", type: "expense" });
    setEditingBudget(null);
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
      const { startDate, endDate } = calculateDateRange(formData.period);
      await createBudget({
        category: formData.category,
        amount,
        period: formData.period,
        startDate,
        endDate,
        type: formData.type,
      });

      toast({ title: "Success", description: "Budget created" });
      setIsAddDialogOpen(false);
      resetForm();
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
      await updateBudget({ id: editingBudget._id, amount });
      toast({ title: "Success", description: "Budget updated" });
      setIsEditDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budget: BudgetRow) => {
    if (!confirm(`Delete budget for "${budget.category}"?`)) return;

    try {
      await removeBudget({ id: budget._id });
      toast({ title: "Success", description: "Budget deleted" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (budget: BudgetRow) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
      type: budget.type,
    });
    setIsEditDialogOpen(true);
  };

  if (budgets === undefined || categories === undefined) {
    return <p className="text-sm text-muted-foreground">Loading budgets...</p>;
  }

  return (
    <div className="space-y-6">
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
            <div>
              <Label htmlFor="budget-type">Type</Label>
              <select
                id="budget-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: e.target.value as BudgetType,
                    category: "",
                  }))
                }
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="giving">Giving</option>
              </select>
            </div>

            <div>
              <Label htmlFor="budget-category">Category</Label>
              <select
                id="budget-category"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full rounded-md border bg-background px-3 py-2"
                required
              >
                <option value="">Select category</option>
                {filteredCategories.map((cat) => (
                  <option key={cat._id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
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

            <div>
              <Label htmlFor="budget-period">Period</Label>
              <select
                id="budget-period"
                value={formData.period}
                onChange={(e) => setFormData((prev) => ({ ...prev, period: e.target.value as BudgetPeriod }))}
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="flex gap-2">
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
            <div>
              <Label>Category</Label>
              <Input value={formData.category} disabled />
            </div>
            <div>
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
            <div className="flex gap-2">
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
            const status = getBudgetStatus(budget.percentUsed);
            return (
              <Card key={budget._id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${budget.type === "expense" ? "bg-rose-500/10" : "bg-emerald-500/10"}`}>
                        {budget.type === "expense" ? (
                          <TrendingDown className="size-4 text-rose-600" />
                        ) : (
                          <TrendingUp className={`size-4 ${budget.type === "income" ? "text-blue-600" : "text-emerald-600"}`} />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{budget.category}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">
                          {budget.period} {budget.type}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(budget)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteBudget(budget)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-semibold">{formatCurrency(budget.spent)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-semibold">{formatCurrency(budget.amount)}</span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        status === "exceeded"
                          ? "bg-rose-500"
                          : status === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {budget.remaining >= 0
                        ? `${formatCurrency(budget.remaining)} remaining`
                        : `${formatCurrency(Math.abs(budget.remaining))} over budget`}
                    </span>
                    {(status === "warning" || status === "exceeded") && (
                      <span className={`inline-flex items-center gap-1 ${status === "exceeded" ? "text-rose-600" : "text-amber-600"}`}>
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
