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
import { Plus, Edit2, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Category {
  _id: string;
  name: string;
  type: "expense" | "giving";
  color: string;
  isDefault: boolean;
}

export function CategoryManagement() {
  const categories = useQuery(api.categories.list, {});
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "expense" as "expense" | "giving",
    color: "#3b82f6",
  });

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // In a real convex app you'd call a mutation here, e.g.
      // await createCategory(formData);
      // For now we simulate an API call to existing REST endpoint or just mock it if we switched fully to Convex
      // Assuming REST endpoint still exists or we should use Convex mutation.
      // Let's assume we use the REST endpoint for now as previous code did,
      // but ideally we should use `useMutation`.
      
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create category");
      }

      toast({
        title: "Success",
        description: "Category created successfully",
      });

      setIsAddDialogOpen(false);
      setFormData({ name: "", type: "expense", color: "#3b82f6" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
        setLoading(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setLoading(true);

    try {
      const response = await fetch(`/api/categories/${editingCategory._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          color: formData.color,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }

      toast({
        title: "Success",
        description: "Category updated successfully",
      });

      setIsEditDialogOpen(false);
      setEditingCategory(null);
      setFormData({ name: "", type: "expense", color: "#3b82f6" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.isDefault) {
      toast({
        title: "Error",
        description: "Cannot delete default categories",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/categories/${category._id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete category");
      }

      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || "#3b82f6",
    });
    setIsEditDialogOpen(true);
  };

  if (categories === undefined) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const givingCategories = categories.filter((c) => c.type === "giving");

  return (
    <div className="space-y-6">
      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div>
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Groceries"
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "expense" | "giving",
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="expense">Expense</option>
                <option value="giving">Giving</option>
              </select>
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="h-10 w-20 border rounded-md cursor-pointer"
                />
                <Input value={formData.color} readOnly className="flex-1" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Adding..." : "Add Category"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditCategory} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Category Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Groceries"
                required
                disabled={editingCategory?.isDefault}
              />
              {editingCategory?.isDefault && (
                <p className="text-xs text-muted-foreground mt-1">
                  Default category names cannot be changed
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-color">Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  id="edit-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="h-10 w-20 border rounded-md cursor-pointer"
                />
                <Input value={formData.color} readOnly className="flex-1" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                 {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingCategory(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Expense Categories */}
        <Card>
            <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
                {expenseCategories.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                    No expense categories
                </p>
                ) : (
                expenseCategories.map((category) => (
                    <div
                    key={category._id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                    <div className="flex items-center gap-3">
                        <div
                        className="w-6 h-6 rounded-full border border-border/20 shadow-sm"
                        style={{ backgroundColor: category.color || "#3b82f6" }}
                        />
                        <div>
                        <p className="font-medium text-sm">{category.name}</p>
                        {category.isDefault && (
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Default
                            </p>
                        )}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(category)}
                        >
                        <Edit2 className="h-4 w-4" />
                        </Button>
                        {!category.isDefault && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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

        {/* Giving Categories */}
        <Card>
            <CardHeader>
            <CardTitle>Giving Categories</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="space-y-2">
                {givingCategories.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                    No giving categories
                </p>
                ) : (
                givingCategories.map((category) => (
                    <div
                    key={category._id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                    <div className="flex items-center gap-3">
                        <div
                        className="w-6 h-6 rounded-full border border-border/20 shadow-sm"
                        style={{ backgroundColor: category.color || "#3b82f6" }}
                        />
                        <div>
                        <p className="font-medium text-sm">{category.name}</p>
                        {category.isDefault && (
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Default
                            </p>
                        )}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(category)}
                        >
                        <Edit2 className="h-4 w-4" />
                        </Button>
                        {!category.isDefault && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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
      </div>

      {/* Info Card */}
      <Card className="bg-muted/30 border-none">
        <CardContent className="pt-6">
          <div className="flex gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-primary" />
            <div>
              <p className="font-medium mb-2 text-foreground">Category Management Tips:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Default categories cannot be deleted</li>
                <li>Categories with existing transactions cannot be deleted</li>
                <li>You can customize colors for all categories</li>
                <li>Default category names cannot be changed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
