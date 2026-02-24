"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, AlertCircle } from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { TransactionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
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

type CategoryType = "expense" | "giving" | "income";

interface ApiCategory {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  is_default: boolean;
  created_at: string | null;
}

export function CategoryManagement() {
  const {
    data: catData,
    loading: categoriesLoading,
    refresh: refreshCategories,
  } = useApiQuery<{ categories: ApiCategory[] }>("/api/categories");
  const categories = catData?.categories;
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiCategory | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "expense" as CategoryType,
    color: "#3b82f6",
  });

  const resetForm = () => {
    setFormData({ name: "", type: "expense", color: "#3b82f6" });
    setEditingCategory(null);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      toast({ title: "Success", description: "Category created" });
      setIsAddDialogOpen(false);
      resetForm();
      refreshCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create category";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    setLoading(true);
    try {
      await apiFetch(`/api/categories/${editingCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          color: formData.color,
        }),
      });
      toast({ title: "Success", description: "Category updated" });
      setIsEditDialogOpen(false);
      resetForm();
      refreshCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update category";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: ApiCategory) => {
    if (category.is_default) {
      toast({ title: "Error", description: "Default categories cannot be deleted", variant: "destructive" });
      return;
    }

    if (!confirm(`Delete "${category.name}"?`)) return;

    try {
      await apiFetch(`/api/categories/${category.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Category deleted" });
      refreshCategories();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete category";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (category: ApiCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || "#3b82f6",
    });
    setIsEditDialogOpen(true);
  };

  if (categoriesLoading || categories === undefined) {
    return <p className="text-sm text-muted-foreground">Loading categories...</p>;
  }

  const grouped = {
    income: categories.filter((c) => c.type === "income"),
    expense: categories.filter((c) => c.type === "expense"),
    giving: categories.filter((c) => c.type === "giving"),
  };

  return (
    <div className="space-y-6">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddCategory} className="space-y-4">
            <div>
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Groceries"
                required
              />
            </div>

            <div>
              <Label htmlFor="category-type">Type</Label>
              <select
                id="category-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, type: e.target.value as CategoryType }))
                }
                className="w-full rounded-md border bg-background px-3 py-2"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="giving">Giving</option>
              </select>
            </div>

            <div>
              <Label htmlFor="category-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="category-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="h-10 w-20 rounded-md border"
                />
                <Input value={formData.color} readOnly />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Adding..." : "Add Category"}
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
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditCategory} className="space-y-4">
            <div>
              <Label htmlFor="edit-category-name">Category Name</Label>
              <Input
                id="edit-category-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                disabled={editingCategory?.is_default}
              />
              {editingCategory?.is_default && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Default category names cannot be changed.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-category-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-category-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="h-10 w-20 rounded-md border"
                  disabled={editingCategory?.is_default}
                />
                <Input value={formData.color} readOnly />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading || !!editingCategory?.is_default}>
                {loading ? "Saving..." : "Save Changes"}
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

      <div className="grid gap-4 md:grid-cols-3">
        {([
          ["Income", grouped.income],
          ["Expense", grouped.expense],
          ["Giving", grouped.giving],
        ] as const).map(([title, list]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title} Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {list.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No categories</p>
                ) : (
                  list.map((category) => (
                    <div key={category.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: category.color || "#3b82f6" }}
                        />
                        <div>
                          <p className="text-sm font-medium">{category.name}</p>
                          {category.is_default && (
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Default</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1">
                        {!category.is_default && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(category)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {!category.is_default && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCategory(category)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
            <p>
              Default categories are protected. Add your own categories when you need a more
              personal breakdown.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
