"use client";

import { useState } from "react";
import { Edit2, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiGoal, GoalCategory } from "@/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: "emergency_fund", label: "Emergency fund" },
  { value: "savings", label: "Savings" },
  { value: "debt_payoff", label: "Debt payoff" },
  { value: "giving", label: "Giving" },
  { value: "travel", label: "Travel" },
  { value: "home", label: "Home" },
  { value: "education", label: "Education" },
  { value: "business", label: "Business" },
  { value: "other", label: "Other" },
];

interface GoalsResponse {
  goals: ApiGoal[];
  total_target: number;
  total_current: number;
  active_count: number;
  completion_rate: number;
}

export function GoalsManagement() {
  const { toast } = useToast();
  const { data, loading, refresh } = useApiQuery<GoalsResponse>("/api/goals");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ApiGoal | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "savings" as GoalCategory,
    targetAmount: "",
    currentAmount: "0",
    targetDate: "",
    notes: "",
  });

  const goals = data?.goals ?? [];

  const resetForm = () => {
    setFormData({
      name: "",
      category: "savings",
      targetAmount: "",
      currentAmount: "0",
      targetDate: "",
      notes: "",
    });
    setEditingGoal(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        targetAmount: Number.parseFloat(formData.targetAmount),
        currentAmount: Number.parseFloat(formData.currentAmount || "0"),
        targetDate: formData.targetDate || null,
        notes: formData.notes || null,
      };

      if (editingGoal) {
        await apiFetch(`/api/goals/${editingGoal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      toast({ title: "Saved", description: editingGoal ? "Goal updated" : "Goal created" });
      setIsAddOpen(false);
      setIsEditOpen(false);
      resetForm();
      refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save goal",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (goal: ApiGoal) => {
    if (!confirm(`Delete goal "${goal.name}"?`)) return;
    try {
      await apiFetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Goal removed" });
      refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete goal",
        variant: "destructive",
      });
    }
  };

  const openEdit = (goal: ApiGoal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      category: goal.category,
      targetAmount: goal.target_amount.toString(),
      currentAmount: goal.current_amount.toString(),
      targetDate: goal.target_date ?? "",
      notes: goal.notes ?? "",
    });
    setIsEditOpen(true);
  };

  const renderForm = () => (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="goal-name">Goal name</Label>
        <Input id="goal-name" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} required />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={formData.category} onValueChange={(value: GoalCategory) => setFormData((prev) => ({ ...prev, category: value }))}>
          <SelectTrigger aria-label="Goal category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {GOAL_CATEGORIES.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="goal-target">Target amount</Label>
          <Input id="goal-target" type="number" min="0.01" step="0.01" value={formData.targetAmount} onChange={(e) => setFormData((prev) => ({ ...prev, targetAmount: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal-current">Current amount</Label>
          <Input id="goal-current" type="number" min="0" step="0.01" value={formData.currentAmount} onChange={(e) => setFormData((prev) => ({ ...prev, currentAmount: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal-date">Target date</Label>
        <Input id="goal-date" type="date" value={formData.targetDate} onChange={(e) => setFormData((prev) => ({ ...prev, targetDate: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal-notes">Notes</Label>
        <Textarea id="goal-notes" value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} rows={3} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving..." : editingGoal ? "Save Changes" : "Create Goal"}</Button>
        <Button type="button" variant="outline" onClick={() => {
          setIsAddOpen(false);
          setIsEditOpen(false);
          resetForm();
        }}>
          Cancel
        </Button>
      </div>
    </form>
  );

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading goals...</p>;
  }

  return (
    <div className="space-y-6">
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Goal</DialogTitle>
          </DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <PiggyBank className="mx-auto mb-3 h-10 w-10 text-primary/60" />
              <p className="font-medium text-foreground">No goals yet</p>
              <p className="mt-1 text-sm">Create a savings target to track progress over time.</p>
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{goal.name}</CardTitle>
                    <p className="text-xs capitalize text-muted-foreground">{goal.category.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Edit goal ${goal.name}`} onClick={() => openEdit(goal)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={`Delete goal ${goal.name}`} onClick={() => handleDelete(goal)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Saved</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(goal.current_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(goal.target_amount)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(goal.progress, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(goal.remaining_amount)} remaining</span>
                  <span>{goal.progress.toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
