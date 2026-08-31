"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Edit2,
  Trash2,
  CalendarDays,
  Receipt,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Circle,
  Clock,
  Undo2,
  Users,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiRecurringOutgoing } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  formatDaysUntilDue,
  getCurrentUtcDate,
  getDueState,
} from "@/lib/outgoings-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/dashboard/panel";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  EMPTY_REBILL,
  NO_CLIENT,
  RebillFields,
  type RebillFormData,
} from "@/components/dashboard/clients/rebill-fields";
import { RebillModeBadge } from "@/components/dashboard/clients/rebill-mode-badge";
import { usePartyLabels } from "@/hooks/use-party-labels";

const OUTGOING_CATEGORIES = [
  "Housing",
  "Utilities",
  "Insurance",
  "Phone & Internet",
  "Subscriptions",
  "Transport",
  "Childcare",
  "Memberships",
  "Other",
];

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function getCurrentMonthLabel() {
  return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

interface RecurringMoneyItem extends Omit<ApiRecurringOutgoing, "payment_status"> {
  payee?: string | null;
  settlement: {
    status: "draft" | "partial" | "settled" | "overpaid";
    recorded_amount: number;
    outstanding_amount: number;
    transaction_id: string | null;
  } | null;
}

interface OutgoingsResponse {
  items: RecurringMoneyItem[];
  monthly_total: number;
  /** The two halves of monthly_total, never netted against each other. */
  monthly_overhead: number;
  monthly_pass_through: number;
  active_count: number;
  period_month: string;
}

function itemIsPaid(item: RecurringMoneyItem) {
  return Boolean(
    item.settlement &&
      item.settlement.recorded_amount > 0 &&
      item.settlement.outstanding_amount === 0,
  );
}

export function RecurringOutgoingsManagement() {
  const { toast } = useToast();
  const partyLabels = usePartyLabels();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<OutgoingsResponse>("/api/recurring-money?type=expense");

  const outgoings = data?.items;
  const monthlyTotal = data?.monthly_total ?? 0;
  const overhead = data?.monthly_overhead ?? 0;
  const passThrough = data?.monthly_pass_through ?? 0;

  // Share of income is the one figure this endpoint cannot answer on its own.
  const { data: analytics } = useApiQuery<{ totalIncome: number }>(
    "/api/analytics?period=month"
  );
  const monthlyIncome = analytics?.totalIncome;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingPayment, setLoggingPayment] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<RecurringMoneyItem | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    dayOfMonth: "",
    category: "",
    notes: "",
    ...EMPTY_REBILL,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      amount: "",
      dayOfMonth: "",
      category: "",
      notes: "",
      ...EMPTY_REBILL,
    });
    setEditingItem(null);
  };

  /** The rebill half of the form, in the shape the API takes. */
  const rebillPayload = (form: RebillFormData) => {
    const clientId = form.clientId === NO_CLIENT ? null : form.clientId;
    const rebillAmount = Number.parseFloat(form.rebillAmount);
    return {
      vendor: form.vendor.trim() || null,
      clientId,
      // A mode without a client cannot mean anything, so the pair is forced
      // consistent here as well as in the form and the CHECK constraint.
      rebillMode: clientId ? form.rebillMode : "none",
      rebillAmount:
        clientId && form.rebillMode === "fixed" && !Number.isNaN(rebillAmount)
          ? rebillAmount
          : null,
    };
  };

  const handleLogPayment = async (item: RecurringMoneyItem) => {
    setLoggingPayment(item.id);
    try {
      await apiFetch(`/api/recurring-money/${item.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAt: getCurrentUtcDate(),
        }),
      });
      toast({
        title: "Payment recorded",
        description: `${item.name} marked as paid for ${getCurrentMonthLabel()}. This will count as an expense.`,
      });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to log payment";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoggingPayment(null);
    }
  };

  const handleUndoPayment = async (item: RecurringMoneyItem) => {
    if (!itemIsPaid(item)) return;
    try {
      await apiFetch(`/api/recurring-money/${item.id}/settle`, { method: "DELETE" });
      toast({
        title: "Payment undone",
        description: `${item.name} marked as unpaid for ${getCurrentMonthLabel()}.`,
      });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to undo payment";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(formData.amount);
    const dayOfMonth = Number.parseInt(formData.dayOfMonth, 10);

    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      toast({ title: "Error", description: "Day must be between 1 and 31", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/recurring-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          amount,
          dayOfMonth,
          frequency: "monthly",
          category: formData.category || null,
          notes: formData.notes || null,
          type: "expense",
          ...rebillPayload(formData),
        }),
      });
      toast({ title: "Success", description: "Outgoing added" });
      setIsAddOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add outgoing";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const amount = Number.parseFloat(formData.amount);
    const dayOfMonth = Number.parseInt(formData.dayOfMonth, 10);

    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      toast({ title: "Error", description: "Day must be between 1 and 31", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/recurring-money/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          amount,
          dayOfMonth,
          frequency: "monthly",
          category: formData.category || null,
          notes: formData.notes || null,
          ...rebillPayload(formData),
        }),
      });
      toast({ title: "Success", description: "Outgoing updated" });
      setIsEditOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update outgoing";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: RecurringMoneyItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await apiFetch(`/api/recurring-money/${item.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Outgoing deleted" });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete outgoing";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (item: RecurringMoneyItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      amount: item.amount.toString(),
      dayOfMonth: item.day_of_month.toString(),
      category: item.category ?? "",
      notes: item.notes ?? "",
      vendor: item.vendor ?? "",
      clientId: item.client_id ?? NO_CLIENT,
      rebillMode: item.rebill_mode,
      rebillAmount: item.rebill_amount?.toString() ?? "",
    });
    setIsEditOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || outgoings === undefined) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load outgoings."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // The month's schedule, in the order the days fall.
  const activeOutgoings = outgoings.filter((o) => o.is_active);
  const schedule = [...outgoings].sort((a, b) => a.day_of_month - b.day_of_month);
  const paidCount = activeOutgoings.filter((o) => itemIsPaid(o)).length;
  const overdueCount = activeOutgoings.filter(
    (o) =>
      !itemIsPaid(o) &&
      getDueState(o.day_of_month, false).urgency === "overdue",
  ).length;
  const upcomingCount = activeOutgoings.length - paidCount - overdueCount;
  const unpaidTotal = activeOutgoings
    .filter((o) => !itemIsPaid(o))
    .reduce((sum, o) => sum + o.amount, 0);
  // Share of income needs income, which this endpoint does not carry.
  const shareOfIncome =
    monthlyIncome && monthlyIncome > 0
      ? Math.round((monthlyTotal / monthlyIncome) * 100)
      : null;

  const formFields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="outgoing-name">Name</Label>
        <Input
          id="outgoing-name"
          placeholder="e.g. Rent, Phone bill"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="outgoing-amount">Amount</Label>
          <Input
            id="outgoing-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outgoing-day">Day of Month</Label>
          <Input
            id="outgoing-day"
            type="number"
            min="1"
            max="31"
            placeholder="1-31"
            value={formData.dayOfMonth}
            onChange={(e) => setFormData((prev) => ({ ...prev, dayOfMonth: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outgoing-category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
        >
          <SelectTrigger id="outgoing-category" aria-label="Category">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {OUTGOING_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <RebillFields
        value={formData}
        onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
      />

      <div className="space-y-2">
        <Label htmlFor="outgoing-notes">Notes (optional)</Label>
        <Input
          id="outgoing-notes"
          placeholder="Any extra details..."
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Committed each month"
          value={formatCurrency(monthlyTotal)}
          // The split is stated only when some of it is carried for someone;
          // an install that never uses clients sees the tile it always had.
          note={
            passThrough > 0
              ? `${formatCurrency(overhead)} yours · ${formatCurrency(passThrough)} carried`
              : undefined
          }
        />
        <StatTile
          label="Still unpaid"
          value={formatCurrency(unpaidTotal)}
          tone={unpaidTotal > 0 ? "text-obligation" : undefined}
        />
        <StatTile
          label="Share of income"
          value={shareOfIncome === null ? "—" : `${shareOfIncome}%`}
          note={passThrough > 0 ? "of gross, before recovery" : undefined}
        />
      </div>

      {/* Add button + dialogs. The Clients link lives here because the sidebar
          is desktop-only and Clients has no slot in the five-item tab bar, so
          this is the one place a phone can reach it before any client exists. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Outgoing
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Regular Outgoing</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              {formFields}
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Adding..." : "Add Outgoing"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashboard/clients">
            <Users className="mr-2 size-4" />
            {partyLabels.plural}
          </Link>
        </Button>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Outgoing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {formFields}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* The month as a schedule, keyed by the day each bill falls due —
          one list read top to bottom, rather than a grid of equal cards. */}
      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-[18px] pb-3.5 sm:px-6">
          <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
            {getCurrentMonthLabel()} schedule
          </h2>
          {activeOutgoings.length > 0 && (
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
              {paidCount} paid · {overdueCount} overdue · {upcomingCount} upcoming
            </span>
          )}
        </div>

        {schedule.length === 0 ? (
          <div className="border-t border-border/60 px-5 py-12 text-center sm:px-6">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
              <CalendarDays className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No outgoings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your regular bills and payments to track them.
            </p>
          </div>
        ) : (
          <ul>
            {schedule.map((item) => {
              const isPaid = itemIsPaid(item);
              const due = getDueState(item.day_of_month, isPaid);
              const isOverdue = !isPaid && item.is_active && due.urgency === "overdue";
              const isToday = !isPaid && item.is_active && due.urgency === "today";
              const isLogging = loggingPayment === item.id;
              const StatusIcon = isPaid
                ? CheckCircle2
                : isOverdue
                ? AlertCircle
                : isToday
                ? Clock
                : CalendarDays;

              return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-border/60 px-5 py-3.5 sm:px-6 ${
                    !item.is_active ? "opacity-60" : ""
                  } ${
                    isOverdue
                      ? "bg-expense-surface/40"
                      : isToday
                      ? "bg-obligation-surface/40"
                      : ""
                  }`}
                >
                  <span
                    className={`w-9 flex-none text-center text-xs tabular-nums ${
                      isOverdue ? "text-expense" : "text-muted-foreground"
                    }`}
                  >
                    {item.day_of_month}
                    {getOrdinalSuffix(item.day_of_month)}
                  </span>

                  <StatusIcon
                    className={`size-4 flex-none ${
                      isOverdue
                        ? "text-expense"
                        : isToday
                        ? "text-obligation"
                        : "text-muted-foreground"
                    }`}
                  />

                  <span className="min-w-[7rem] flex-1">
                    <span
                      className={`block truncate text-[13.5px] font-medium ${
                        isPaid ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {item.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-muted-foreground">
                      {item.category && <span>{item.category}</span>}
                      {item.frequency !== "monthly" && <span>· {item.frequency}</span>}
                      {item.client_name && (
                        <>
                          <span>· for {item.client_name}</span>
                          <RebillModeBadge mode={item.rebill_mode} />
                        </>
                      )}
                    </span>
                  </span>

                  <span className="flex w-full flex-wrap items-center justify-end gap-x-3.5 gap-y-2 sm:w-auto sm:flex-nowrap">
                  <span className="flex-none">
                    {isPaid ? (
                      <span className="rounded-md bg-secondary px-2 py-[3px] text-[11.5px] text-muted-foreground">
                        Paid
                      </span>
                    ) : isOverdue ? (
                      <span className="rounded-md bg-expense-surface px-2 py-[3px] text-[11.5px] font-medium text-expense">
                        {formatDaysUntilDue(due.daysUntilDue)}
                      </span>
                    ) : (
                      <span
                        className={`text-[11.5px] ${
                          isToday ? "font-medium text-obligation" : "text-muted-foreground"
                        }`}
                      >
                        {formatDaysUntilDue(due.daysUntilDue)}
                      </span>
                    )}
                  </span>

                  <span
                    className={`flex-none text-right text-sm font-semibold tabular-nums sm:w-[90px] ${
                      isPaid
                        ? "text-muted-foreground"
                        : isOverdue
                        ? "text-expense"
                        : "text-foreground"
                    }`}
                  >
                    {formatCurrency(item.amount)}
                  </span>

                  <span className="flex flex-none items-center gap-1">
                    {item.is_active &&
                      (isPaid ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-muted-foreground"
                          onClick={() => handleUndoPayment(item)}
                        >
                          <Undo2 className="size-3" />
                          Undo
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          disabled={isLogging}
                          onClick={() => handleLogPayment(item)}
                        >
                          {isLogging ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Circle className="size-3" />
                          )}
                          Log paid
                        </Button>
                      ))}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => openEditDialog(item)}
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
