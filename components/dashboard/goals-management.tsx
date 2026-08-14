"use client";

import { useState } from "react";
import { CircleDollarSign, Edit2, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiGoal, ApiGoalActivity, GoalCategory } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  total_funded: number;
  active_count: number;
  completion_rate: number;
}

interface GoalActivitiesResponse {
  activities: ApiGoalActivity[];
}

const formatGoalDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function GoalsManagement() {
  const { toast } = useToast();
  const { data, loading, refresh } = useApiQuery<GoalsResponse>("/api/goals");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ApiGoal | null>(null);
  const [activityGoalId, setActivityGoalId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({
    type: "contribution" as "contribution" | "spending",
    amount: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    category: "savings" as GoalCategory,
    targetAmount: "",
    currentAmount: "0",
    targetDate: "",
    notes: "",
  });

  const {
    data: activityData,
    loading: activitiesLoading,
    refresh: refreshActivities,
  } = useApiQuery<GoalActivitiesResponse>(
    activityGoalId ? `/api/goals/${activityGoalId}/activities` : null,
  );

  const goals = data?.goals ?? [];
  const activityGoal = goals.find((goal) => goal.id === activityGoalId) ?? null;

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

  const handleActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activityGoal) return;

    setSavingActivity(true);
    try {
      await apiFetch(`/api/goals/${activityGoal.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activityForm.type,
          amount: Number.parseFloat(activityForm.amount),
          occurredOn: activityForm.occurredOn,
          notes: activityForm.notes || null,
        }),
      });
      toast({
        title: "Activity recorded",
        description: activityForm.type === "contribution" ? "Fund balance increased" : "Fund spending recorded",
      });
      setActivityForm((current) => ({ ...current, amount: "", notes: "" }));
      refresh();
      refreshActivities();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record activity",
        variant: "destructive",
      });
    } finally {
      setSavingActivity(false);
    }
  };

  const openActivity = (goal: ApiGoal) => {
    setActivityGoalId(goal.id);
    setActivityForm({
      type: "contribution",
      amount: "",
      occurredOn: new Date().toISOString().slice(0, 10),
      notes: "",
    });
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
          <Label htmlFor="goal-current">Available amount</Label>
          <Input id="goal-current" type="number" min="0" step="0.01" value={formData.currentAmount} onChange={(e) => setFormData((prev) => ({ ...prev, currentAmount: e.target.value }))} />
          <p className="text-xs text-muted-foreground">Starting balance. Future changes can be recorded as fund activity.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal-date">Target date</Label>
        <Input id="goal-date" type="date" value={formData.targetDate} onChange={(e) => setFormData((prev) => ({ ...prev, targetDate: e.target.value }))} />
        <p className="text-xs text-muted-foreground">Optional. Add a date to calculate a monthly sinking-fund plan.</p>
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
            <Plus className="h-4 w-4" />
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

      <Dialog
        open={activityGoalId !== null}
        onOpenChange={(open) => {
          if (!open && !savingActivity) setActivityGoalId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record fund activity</DialogTitle>
            <DialogDescription>
              {activityGoal?.name} · {formatCurrency(activityGoal?.available_amount ?? 0)} available
            </DialogDescription>
          </DialogHeader>

          {activityGoal && (
            <form onSubmit={handleActivity} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Activity</Label>
                  <Select
                    value={activityForm.type}
                    onValueChange={(type: "contribution" | "spending") =>
                      setActivityForm((current) => ({ ...current, type }))
                    }
                  >
                    <SelectTrigger aria-label="Fund activity type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contribution">Add funds</SelectItem>
                      <SelectItem value="spending">Record spending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-activity-amount">Amount</Label>
                  <Input
                    id="goal-activity-amount"
                    type="number"
                    min="0.01"
                    max={activityForm.type === "spending" ? activityGoal.available_amount : undefined}
                    step="0.01"
                    value={activityForm.amount}
                    onChange={(event) =>
                      setActivityForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-activity-date">Date</Label>
                <Input
                  id="goal-activity-date"
                  type="date"
                  value={activityForm.occurredOn}
                  onChange={(event) =>
                    setActivityForm((current) => ({ ...current, occurredOn: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-activity-notes">Notes</Label>
                <Input
                  id="goal-activity-notes"
                  maxLength={1000}
                  value={activityForm.notes}
                  onChange={(event) =>
                    setActivityForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <Button type="submit" className="w-full" disabled={savingActivity}>
                {savingActivity
                  ? "Recording..."
                  : activityForm.type === "contribution"
                    ? "Add Funds"
                    : "Record Spending"}
              </Button>
            </form>
          )}

          <div className="border-t border-border/60 pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Activity history
            </p>
            {activitiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : !activityData || activityData.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fund activity recorded yet.</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {activityData.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {activity.type === "contribution" ? "Funds added" : "Spent from fund"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatGoalDate(activity.occurred_on)}
                        {activity.notes ? ` · ${activity.notes}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {activity.type === "contribution" ? "+" : "−"}
                      {formatCurrency(activity.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Record activity for ${goal.name}`} onClick={() => openActivity(goal)}>
                      <CircleDollarSign className="h-3.5 w-3.5" />
                    </Button>
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Planned</span>
                  <span className="text-right font-semibold tabular-nums">{formatCurrency(goal.target_amount)}</span>
                  <span className="text-muted-foreground">Funded</span>
                  <span className="text-right font-semibold tabular-nums">{formatCurrency(goal.funded_amount)}</span>
                  <span className="text-muted-foreground">Spent</span>
                  <span className="text-right font-semibold tabular-nums">{formatCurrency(goal.spent_amount)}</span>
                  <span className="text-muted-foreground">Available</span>
                  <span className="text-right font-semibold tabular-nums">{formatCurrency(goal.available_amount)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(goal.progress, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(goal.remaining_amount)} remaining</span>
                  <span>{goal.progress.toFixed(0)}%</span>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
                  {goal.funding_status === "complete" ? (
                    <p className="font-medium">Fully funded</p>
                  ) : goal.funding_status === "overdue" ? (
                    <>
                      <p className="font-medium text-expense">Target overdue</p>
                      <p className="mt-1 text-muted-foreground">
                        {formatCurrency(goal.remaining_amount)} is still needed
                        {goal.target_date ? ` · target was ${formatGoalDate(goal.target_date)}` : ""}.
                      </p>
                    </>
                  ) : goal.funding_status === "scheduled" && goal.monthly_contribution !== null && goal.target_date ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Monthly plan</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(goal.monthly_contribution)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {goal.months_remaining} {goal.months_remaining === 1 ? "month" : "months"} until {formatGoalDate(goal.target_date)}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Add a target date for a monthly funding plan.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
