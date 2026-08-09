"use client";

import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Landmark,
  TrendingUp,
  TrendingDown,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
  CalendarDays,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiInvestment } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EventHistorySection } from "./investments/event-history-section";
import { EmptyState, StatTile } from "@/components/dashboard/panel";
import {
  InvestmentFormFields,
  INVESTMENT_TYPE_LABELS,
  type InvestmentFormData,
} from "./investments/investment-form-fields";

interface InvestmentsResponse {
  investments: ApiInvestment[];
  total_cost_basis: number;
  total_current_value: number;
  total_gain_loss: number;
  active_count: number;
}

const EMPTY_FORM: InvestmentFormData = {
  name: "",
  investmentType: "stock",
  platform: "",
  costBasis: "",
  currentValue: "",
  quantity: "",
  purchaseDate: "",
  notes: "",
};

// ── Main Component ──────────────────────────────────────────────────────

/**
 * Shared by the column head and every row so the two cannot drift apart.
 * Passed as a custom property rather than interpolated into the class name:
 * Tailwind scans source for literal class strings, so a built-up
 * `grid-cols-[...]` would never be compiled.
 */
const HOLDING_COLUMNS = "minmax(160px,1.4fr) 88px 110px 110px 110px 150px 88px";

export function InvestmentsManagement() {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<InvestmentsResponse>("/api/investments");

  const investments = data?.investments;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiInvestment | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<InvestmentFormData>({ ...EMPTY_FORM });

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingItem(null);
  };

  const buildPayload = () => {
    const costBasis = Number.parseFloat(formData.costBasis);
    const currentValue = Number.parseFloat(formData.currentValue);
    if (Number.isNaN(costBasis) || costBasis < 0) return null;
    if (Number.isNaN(currentValue) || currentValue < 0) return null;

    return {
      name: formData.name,
      investmentType: formData.investmentType,
      platform: formData.platform || null,
      costBasis,
      currentValue,
      quantity: formData.quantity ? Number.parseFloat(formData.quantity) : null,
      purchaseDate: formData.purchaseDate,
      notes: formData.notes || null,
    };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      toast({ title: "Error", description: "Enter valid cost basis and current value", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Investment added" });
      setIsAddOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const payload = buildPayload();
    if (!payload) {
      toast({ title: "Error", description: "Enter valid cost basis and current value", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/investments/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Investment updated" });
      setIsEditOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ApiInvestment) => {
    if (!confirm(`Delete "${item.name}"? This will also remove all event history.`)) return;
    try {
      await apiFetch(`/api/investments/${item.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Investment deleted" });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (item: ApiInvestment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      investmentType: item.investment_type,
      platform: item.platform ?? "",
      costBasis: item.cost_basis.toString(),
      currentValue: item.current_value.toString(),
      quantity: item.quantity?.toString() ?? "",
      purchaseDate: item.purchase_date,
      notes: item.notes ?? "",
    });
    setIsEditOpen(true);
  };

  const handleFormChange = (updates: Partial<InvestmentFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || investments === undefined) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load investments."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalGainLoss = data?.total_gain_loss ?? 0;
  const totalCostBasis = data?.total_cost_basis ?? 0;
  const totalCurrentValue = data?.total_current_value ?? 0;
  const totalReturnPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const isPositiveReturn = totalGainLoss >= 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total invested" value={formatCurrency(totalCostBasis)} />
        <StatTile label="Current value" value={formatCurrency(totalCurrentValue)} />
        {/* A gain is neutral ink; only a loss earns a money colour. */}
        <StatTile
          label="Total return"
          value={`${isPositiveReturn ? "+" : "−"}${formatCurrency(Math.abs(totalGainLoss))}`}
          tone={isPositiveReturn ? undefined : "text-expense"}
          note={`${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}%`}
        />
      </div>

      {/* Add button + dialogs */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Investment
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Investment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <InvestmentFormFields formData={formData} onChange={handleFormChange} />
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Adding..." : "Add"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Investment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <InvestmentFormFields formData={formData} onChange={handleFormChange} />
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

      {/* Six comparable columns. The spec floors the grid at 900px and scrolls
          it horizontally rather than letting the numbers collapse — a cost
          basis you cannot line up against a current value is not worth showing. */}
      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-card">
        {investments.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No investments yet"
            description="Add a holding to track its cost basis and current value."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div
                className="grid grid-cols-[var(--cols)] gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground sm:px-6"
                style={{ "--cols": HOLDING_COLUMNS } as React.CSSProperties}
              >
                <span>Holding</span>
                <span>Type</span>
                <span>Platform</span>
                <span className="text-right">Cost basis</span>
                <span className="text-right">Current value</span>
                <span className="text-right">Gain / loss</span>
                <span className="sr-only">Actions</span>
              </div>

              <ul>
                {investments.map((item) => {
                  const isPositive = item.gain_loss >= 0;
                  const expanded = expandedId === item.id;

                  return (
                    <li key={item.id} className="border-t border-border/60">
                      <div
                        className="grid grid-cols-[var(--cols)] items-center gap-3 px-5 py-3.5 sm:px-6"
                        style={{ "--cols": HOLDING_COLUMNS } as React.CSSProperties}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium">{item.name}</p>
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            Purchased{" "}
                            {new Date(item.purchase_date).toLocaleDateString("en-GB")}
                            {item.quantity != null && ` · qty ${item.quantity}`}
                          </p>
                        </div>

                        <span className="justify-self-start rounded-md bg-secondary px-2 py-[3px] text-[11.5px] text-muted-foreground">
                          {INVESTMENT_TYPE_LABELS[item.investment_type]}
                        </span>

                        <span className="truncate text-[13px] text-muted-foreground">
                          {item.platform ?? "—"}
                        </span>

                        <span className="text-right text-[13px] tabular-nums">
                          {formatCurrency(item.cost_basis)}
                        </span>

                        <span className="text-right text-sm font-semibold tabular-nums">
                          {formatCurrency(item.current_value)}
                        </span>

                        {/* Neutral on the way up, Outflow Rose on the way down. */}
                        <span
                          className={`flex items-center justify-end gap-1.5 text-[13px] font-semibold tabular-nums ${
                            isPositive ? "text-foreground" : "text-expense"
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="size-3.5" />
                          ) : (
                            <TrendingDown className="size-3.5" />
                          )}
                          {isPositive ? "+" : "−"}
                          {formatCurrency(Math.abs(item.gain_loss))} (
                          {item.gain_loss_pct >= 0 ? "+" : ""}
                          {item.gain_loss_pct.toFixed(2)}%)
                        </span>

                        <span className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`${expanded ? "Hide" : "Show"} event history for ${item.name}`}
                            aria-expanded={expanded}
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                          >
                            {expanded ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <History className="size-3.5" />
                            )}
                          </Button>
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
                      </div>

                      {expanded && (
                        <div className="border-t border-border/60 bg-sunken px-5 py-4 sm:px-6">
                          {item.notes && (
                            <p className="mb-3 text-[12.5px] text-muted-foreground">
                              {item.notes}
                            </p>
                          )}
                          <EventHistorySection
                            investmentId={item.id}
                            onChanged={refresh}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
