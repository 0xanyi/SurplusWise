"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Plus, Edit2, Trash2, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: "monthly" | "quarterly" | "yearly";
  start_date: string;
  end_date: string;
  type: "expense" | "giving" | "income";
  is_active: boolean;
  spent: number;
  remaining: number;
  percentage: number;
  status: "ok" | "warning" | "exceeded";
}

export function BudgetManagement() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const categories = useQuery(api.categories.list, {});
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    period: "monthly" as "monthly" | "quarterly" | "yearly",
    type: "expense" as "expense" | "giving" | "income",
  });

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/budgets");
      const data = await response.json();
      setBudgets(data.budgets || []);
    } catch (error) {
      console.error("Failed to fetch budgets:", error);
      toast({
        title: "Error",
        description: "Failed to load budgets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const calculateDateRange = (period: string) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end: Date;

    switch (period) {
      case "monthly":
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarterly":
        const quarter = Math.floor(now.getMonth() / 3);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case "yearly":
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return {
      start_date: start.toISOString().split("T")[0],
      end_date: end.toISOString().split("T")[0],
    };
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dateRange = calculateDateRange(formData.period);

      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          ...dateRange,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create budget");
      }

      toast({
        title: "Success",
        description: "Budget created successfully",
      });

      setIsAddDialogOpen(false);
      setFormData({ category: "", amount: "", period: "monthly", type: "expense" });
      fetchBudgets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;

    try {
      const response = await fetch(`/api/budgets/${editingBudget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update budget");
      }

      toast({
        title: "Success",
        description: "Budget updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingBudget(null);
      setFormData({ category: "", amount: "", period: "monthly", type: "expense" });
      fetchBudgets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    if (!confirm(`Are you sure you want to delete the budget for "${budget.category}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/budgets/${budget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete budget");
      }

      toast({
        title: "Success",
        description: "Budget deleted successfully",
      });

      fetchBudgets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
      type: budget.type,
    });
    setIsEditDialogOpen(true);
  };

  const filteredCategories = (categories ?? []).filter((c) => c.type === formData.type);

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading budgets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Budget Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Budget</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBudget} className="space-y-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "expense" | "giving" | "income",
                    category: "",
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="giving">Giving</option>
              </select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
                required
              >
                <option value="">Select a category</option>
                {filteredCategories.map((cat) => (
                  <option key={cat._id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="amount">Budget Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="period">Period</Label>
              <select
                id="period"
                value={formData.period}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    period: e.target.value as "monthly" | "quarterly" | "yearly",
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Create Budget
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

      {/* Edit Budget Dialog */}
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
              <Label htmlFor="edit-amount">Budget Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingBudget(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Budgets List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.length === 0 ? (
          <div className="col-span-full">
            <Card>
                <CardContent className="pt-6">
                <div className="text-center py-12 text-muted-foreground">
                    <p className="font-medium">No budgets created yet</p>
                    <p className="text-sm mt-2">
                    Create your first budget to start tracking your spending
                    </p>
                </div>
                </CardContent>
            </Card>
          </div>
        ) : (
          budgets.map((budget) => (
            <Card key={budget.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${budget.type === "expense" ? "bg-red-500/10" : "bg-green-500/10"}`}>
                        {budget.type === "expense" ? (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        ) : (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        )}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{budget.category}</CardTitle>
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
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteBudget(budget)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Spent</p>
                            <p className={`font-semibold ${budget.status === 'exceeded' ? 'text-red-600' : budget.status === 'warning' ? 'text-amber-600' : ''}`}>
                                {formatCurrency(budget.spent)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">Budget</p>
                            <p className="font-semibold">{formatCurrency(budget.amount)}</p>
                        </div>
                    </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{Math.min(budget.percentage, 100).toFixed(1)}%</span>
                      {budget.status === 'exceeded' && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Over budget
                        </span>
                      )}
                      {budget.status === 'warning' && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          Near limit
                        </span>
                      )}
                      {budget.status === 'ok' && (
                          <span className="text-green-600">On track</span>
                      )}
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          budget.status === 'exceeded'
                            ? 'bg-red-500'
                            : budget.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground">
                    <span>Remaining: <span className={budget.remaining < 0 ? 'text-red-500 font-medium' : 'text-green-500 font-medium'}>{formatCurrency(Math.abs(budget.remaining))}</span></span>
                    <span>Ends: {new Date(budget.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
