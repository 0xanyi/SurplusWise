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
import type {
  ApiInvestment,
  ApiInvestmentEvent,
  InvestmentType,
  InvestmentEventType,
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  stock: "Stock",
  crypto: "Crypto",
  forex: "Forex",
  property: "Property",
  business: "Business",
  savings: "Savings",
  other: "Other",
};

const EVENT_TYPE_LABELS: Record<InvestmentEventType, string> = {
  return: "Return",
  dividend: "Dividend",
  sale: "Full Sale",
  partial_sale: "Partial Sale",
  loss: "Loss",
  fee: "Fee",
};

interface InvestmentsResponse {
  investments: ApiInvestment[];
  total_cost_basis: number;
  total_current_value: number;
  total_gain_loss: number;
  active_count: number;
}

interface InvestmentFormData {
  name: string;
  investmentType: InvestmentType;
  platform: string;
  costBasis: string;
  currentValue: string;
  quantity: string;
  purchaseDate: string;
  notes: string;
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

// ── Inline EventHistorySection ──────────────────────────────────────────

interface EventHistorySectionProps {
  investmentId: string;
  onChanged: () => void;
}

function getEventColor(eventType: InvestmentEventType) {
  switch (eventType) {
    case "return":
    case "dividend":
      return "text-emerald-600 dark:text-emerald-400";
    case "sale":
    case "partial_sale":
      return "text-blue-600 dark:text-blue-400";
    case "loss":
    case "fee":
      return "text-rose-600 dark:text-rose-400";
    default:
      return "text-muted-foreground";
  }
}

function getEventBg(eventType: InvestmentEventType) {
  switch (eventType) {
    case "return":
    case "dividend":
      return "bg-emerald-50 dark:bg-emerald-950/30";
    case "sale":
    case "partial_sale":
      return "bg-blue-50 dark:bg-blue-950/30";
    case "loss":
    case "fee":
      return "bg-rose-50 dark:bg-rose-950/30";
    default:
      return "bg-muted/50";
  }
}

function EventHistorySection({ investmentId, onChanged }: EventHistorySectionProps) {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<{ events: ApiInvestmentEvent[] }>(
    `/api/investments/${investmentId}/events`,
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    eventType: "return" as InvestmentEventType,
    amount: "",
    eventDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/investments/${investmentId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: formData.eventType,
          amount,
          eventDate: formData.eventDate,
          notes: formData.notes || null,
        }),
      });

      toast({ title: "Success", description: "Event logged" });
      setIsAddOpen(false);
      setFormData({
        eventType: "return",
        amount: "",
        eventDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      refresh();
      onChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to log event";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const events = data?.events ?? [];

  return (
    <div className="space-y-3 border-t border-border/50 pt-3 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <History className="size-3.5" />
          Event History
        </h4>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="size-3 mr-1" />
              Log Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Investment Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-type">Event Type</Label>
                <Select
                  value={formData.eventType}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      eventType: val as InvestmentEventType,
                    }))
                  }
                >
                  <SelectTrigger id="event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(EVENT_TYPE_LABELS) as [InvestmentEventType, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-amount">Amount</Label>
                <Input
                  id="event-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, eventDate: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-notes">Notes (optional)</Label>
                <Input
                  id="event-notes"
                  placeholder="e.g. Quarterly dividend"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : "Log Event"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No events recorded yet
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {events.slice(0, 6).map((event) => (
            <div
              key={event.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${getEventBg(event.event_type)}`}
            >
              <div>
                <p className={`font-medium text-xs ${getEventColor(event.event_type)}`}>
                  {EVENT_TYPE_LABELS[event.event_type]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.event_date).toLocaleDateString("en-GB")}
                  {event.notes && (
                    <span className="ml-2">· {event.notes}</span>
                  )}
                </p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${getEventColor(event.event_type)}`}>
                {formatCurrency(event.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

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

  const formFields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="inv-name">Name</Label>
        <Input
          id="inv-name"
          placeholder='e.g. "Tesla Stock", "Bitcoin"'
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-type">Type</Label>
        <Select
          value={formData.investmentType}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, investmentType: val as InvestmentType }))
          }
        >
          <SelectTrigger id="inv-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(INVESTMENT_TYPE_LABELS) as [InvestmentType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-platform">Platform (optional)</Label>
        <Input
          id="inv-platform"
          placeholder='e.g. "Trading212", "Binance"'
          value={formData.platform}
          onChange={(e) => setFormData((prev) => ({ ...prev, platform: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="inv-cost-basis">Cost Basis</Label>
          <Input
            id="inv-cost-basis"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.costBasis}
            onChange={(e) => setFormData((prev) => ({ ...prev, costBasis: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-current-value">Current Value</Label>
          <Input
            id="inv-current-value"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.currentValue}
            onChange={(e) => setFormData((prev) => ({ ...prev, currentValue: e.target.value }))}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="inv-quantity">Quantity / Units (optional)</Label>
          <Input
            id="inv-quantity"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 10"
            value={formData.quantity}
            onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-purchase-date">Purchase Date</Label>
          <Input
            id="inv-purchase-date"
            type="date"
            value={formData.purchaseDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, purchaseDate: e.target.value }))}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-notes">Notes (optional)</Label>
        <Input
          id="inv-notes"
          placeholder="e.g. Long-term hold"
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  {formatCurrency(totalCostBasis)}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3">
                <Landmark className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    isPositiveReturn
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatCurrency(totalCurrentValue)}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  isPositiveReturn
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : "bg-rose-50 dark:bg-rose-950/30"
                }`}
              >
                {isPositiveReturn ? (
                  <TrendingUp
                    className={`size-6 ${
                      isPositiveReturn
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  />
                ) : (
                  <TrendingDown className="size-6 text-rose-600 dark:text-rose-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    isPositiveReturn
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {totalGainLoss >= 0 ? "+" : ""}
                  {formatCurrency(totalGainLoss)}
                </p>
                <p
                  className={`text-xs font-medium tabular-nums ${
                    isPositiveReturn
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {totalReturnPct >= 0 ? "+" : ""}
                  {totalReturnPct.toFixed(2)}%
                </p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  isPositiveReturn
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : "bg-rose-50 dark:bg-rose-950/30"
                }`}
              >
                {isPositiveReturn ? (
                  <TrendingUp className="size-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="size-6 text-rose-600 dark:text-rose-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
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
            {formFields}
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

      {/* Investments list */}
      <div className="grid gap-4 md:grid-cols-2">
        {investments.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No investments</p>
              <p className="text-sm mt-1">Add stocks, crypto, or other investments to track them.</p>
            </CardContent>
          </Card>
        ) : (
          investments.map((item) => {
            const gainLoss = item.gain_loss;
            const gainLossPct = item.gain_loss_pct;
            const isPositive = gainLoss >= 0;

            return (
              <Card key={item.id} className={!item.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl p-2 bg-blue-50 dark:bg-blue-950/30">
                        <Landmark className="size-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
                            {INVESTMENT_TYPE_LABELS[item.investment_type]}
                          </span>
                          {item.platform && (
                            <span className="ml-1.5">· {item.platform}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cost Basis</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(item.cost_basis)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Value</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(item.current_value)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gain / Loss</span>
                    <span
                      className={`font-semibold tabular-nums flex items-center gap-1 ${
                        isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="size-3.5" />
                      ) : (
                        <TrendingDown className="size-3.5" />
                      )}
                      {gainLoss >= 0 ? "+" : ""}
                      {formatCurrency(gainLoss)} ({gainLossPct >= 0 ? "+" : ""}
                      {gainLossPct.toFixed(2)}%)
                    </span>
                  </div>

                  {item.quantity != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium tabular-nums">{item.quantity}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      Purchased
                    </span>
                    <span className="font-medium">
                      {new Date(item.purchase_date).toLocaleDateString("en-GB")}
                    </span>
                  </div>

                  {/* Expand/collapse event history */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground mt-2"
                    onClick={() =>
                      setExpandedId(expandedId === item.id ? null : item.id)
                    }
                  >
                    <History className="size-3 mr-1" />
                    {expandedId === item.id ? "Hide" : "Show"} Event History
                    {expandedId === item.id ? (
                      <ChevronUp className="size-3 ml-1" />
                    ) : (
                      <ChevronDown className="size-3 ml-1" />
                    )}
                  </Button>

                  {expandedId === item.id && (
                    <EventHistorySection investmentId={item.id} onChanged={refresh} />
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
