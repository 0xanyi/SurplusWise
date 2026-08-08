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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    if (!confirm(`Delete "${category.name}"? Any transactions using this category will keep their current category label.`)) return;

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
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Groceries"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: CategoryType) =>
                  setFormData((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger id="category-type" aria-label="Category type">
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
              <Label htmlFor="category-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="category-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="h-10 w-20 cursor-pointer rounded-lg border"
                />
                <Input value={formData.color} readOnly />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
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
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Category Name</Label>
              <Input
                id="edit-category-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category-color">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-category-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="h-10 w-20 cursor-pointer rounded-lg border"
                />
                <Input value={formData.color} readOnly />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
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
              <CardTitle className="text-base">{title} Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {list.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No categories</p>
                ) : (
                  list.map((category) => (
                    <div key={category.id} className="flex items-center justify-between rounded-xl border border-border/50 p-3 transition-colors hover:bg-accent/30">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-5 w-5 rounded-full border"
                          style={{ backgroundColor: category.color || "#3b82f6" }}
                        />
                        <div>
                          <p className="text-sm font-medium">{category.name}</p>
                          {category.is_default && (
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Default</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Edit category ${category.name}`}
                          onClick={() => openEditDialog(category)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label={`Delete category ${category.name}`}
                          onClick={() => handleDeleteCategory(category)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30 border-border/40">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              You can edit or delete any category. Deleting a category won&apos;t remove
              existing transactions — they&apos;ll keep their current label.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
