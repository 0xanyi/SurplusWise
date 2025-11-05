"use client";

import { useState, useEffect } from "react";
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

interface Budget {
  id: string;
  category: string;
  amount: number;
  period: "monthly" | "quarterly" | "yearly";
  start_date: string;
  end_date: string;
  type: "expense" | "giving";
  is_active: boolean;
  spent: number;
  remaining: number;
  percentage: number;
  status: "ok" | "warning" | "exceeded";
}

interface Category {
  id: string;
  name: string;
  type: "expense" | "giving";
}

export function BudgetManagement() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    period: "monthly" as "monthly" | "quarterly" | "yearly",
    type: "expense" as "expense" | "giving",
  });

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchBudgets = async () => {
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
  };

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
        method: "PUT",
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

  const filteredCategories = categories.filter((c) => c.type === formData.type);

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
          <Button>
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
                    type: e.target.value as "expense" | "giving",
                    category: "",
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
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
                  <option key={cat.id} value={cat.name}>
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
      <div className="grid gap-4">
        {budgets.length === 0 ? (
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
        ) : (
          budgets.map((budget) => (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {budget.type === "expense" ? (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{budget.category}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">
                        {budget.period} {budget.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(budget)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteBudget(budget)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Budget:</span>
                    <span className="font-medium">{formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spent:</span>
                    <span className={`font-medium ${budget.status === 'exceeded' ? 'text-red-600' : budget.status === 'warning' ? 'text-amber-600' : ''}`}>
                      {formatCurrency(budget.spent)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className={`font-medium ${budget.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(budget.remaining))}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{budget.percentage.toFixed(1)}% used</span>
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
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          budget.status === 'exceeded'
                            ? 'bg-red-600'
                            : budget.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    Period: {new Date(budget.start_date).toLocaleDateString()} -{' '}
                    {new Date(budget.end_date).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
