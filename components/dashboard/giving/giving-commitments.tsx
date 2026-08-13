"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiFetch, useApiQuery, useWorkspaceCurrency } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { TRANSACTION_CHANGED_EVENT } from "@/lib/client-events";
import { formatCurrency } from "@/lib/utils";
import type {
  ApiGivingCommitment,
  ApiGivingRecipient,
  GivingCommitmentFrequency,
} from "@/types";

const NO_DESIGNATION = "__no_designation__";

interface ProgressResponse {
  period_start: string;
  period_end: string;
  expected: number;
  recorded: number;
  income_context: {
    income: number;
    giving: number;
    giving_rate: number | null;
  };
  commitments: ApiGivingCommitment[];
}

function currentYearRange() {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function GivingCommitments() {
  const { toast } = useToast();
  const currency = useWorkspaceCurrency();
  const [initialRange] = useState(currentYearRange);
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [showIncomeContext, setShowIncomeContext] = useState(false);
  const recipientsQuery = useApiQuery<{ recipients: ApiGivingRecipient[] }>(
    "/api/giving-recipients?active=true",
  );
  const progressQuery = useApiQuery<ProgressResponse>(
    `/api/giving-commitments?startDate=${appliedRange.start}&endDate=${appliedRange.end}`,
  );
  const recipients = recipientsQuery.data?.recipients ?? [];
  const refreshRecipients = recipientsQuery.refresh;
  const refreshProgress = progressQuery.refresh;

  useEffect(() => {
    window.addEventListener("giving-recipients-changed", refreshRecipients);
    return () => window.removeEventListener("giving-recipients-changed", refreshRecipients);
  }, [refreshRecipients]);

  useEffect(() => {
    window.addEventListener(TRANSACTION_CHANGED_EVENT, refreshProgress);
    return () => window.removeEventListener(TRANSACTION_CHANGED_EVENT, refreshProgress);
  }, [refreshProgress]);

  const [name, setName] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [designationId, setDesignationId] = useState(NO_DESIGNATION);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<GivingCommitmentFrequency>("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedRecipient = recipients.find((recipient) => recipient.id === recipientId);
  const validAmount = Number(amount) > 0;

  useEffect(() => {
    if (recipientId && !selectedRecipient) {
      setRecipientId("");
      setDesignationId(NO_DESIGNATION);
    } else if (
      designationId !== NO_DESIGNATION &&
      !selectedRecipient?.designations.some((designation) => designation.id === designationId)
    ) {
      setDesignationId(NO_DESIGNATION);
    }
  }, [designationId, recipientId, selectedRecipient]);

  const createCommitment = async () => {
    if (!name.trim() || !recipientId || !validAmount || !startDate) return;
    setSaving(true);
    try {
      await apiFetch("/api/giving-commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          recipientId,
          designationId: designationId === NO_DESIGNATION ? null : designationId,
          amount: Number(amount),
          frequency,
          startDate,
          endDate: endDate || null,
        }),
      });
      setName("");
      setAmount("");
      setEndDate("");
      progressQuery.refresh();
      toast({ title: "Giving commitment added" });
    } catch (error) {
      toast({
        title: "Could not add commitment",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleCommitment = async (commitment: ApiGivingCommitment) => {
    try {
      await apiFetch(`/api/giving-commitments/${commitment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !commitment.is_active }),
      });
      progressQuery.refresh();
    } catch (error) {
      toast({
        title: "Could not update commitment",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const expected = progressQuery.data?.expected ?? 0;
  const recorded = progressQuery.data?.recorded ?? 0;
  const remaining = Math.max(0, expected - recorded);

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-5 sm:pt-6">
          <div>
            <h2 className="font-display text-base font-semibold">Add a commitment or pledge</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This sets an expectation only. It never creates or changes a transaction.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="commitment-name">Name</Label>
              <Input id="commitment-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Monthly partnership" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Select value={recipientId} onValueChange={(value) => { setRecipientId(value); setDesignationId(NO_DESIGNATION); }}>
                <SelectTrigger aria-label="Commitment recipient"><SelectValue placeholder="Select recipient" /></SelectTrigger>
                <SelectContent>
                  {recipients.map((recipient) => <SelectItem key={recipient.id} value={recipient.id}>{recipient.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fund / designation</Label>
              <Select value={designationId} onValueChange={setDesignationId} disabled={!recipientId}>
                <SelectTrigger aria-label="Commitment fund"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DESIGNATION}>General / undesignated</SelectItem>
                  {selectedRecipient?.designations.map((designation) => <SelectItem key={designation.id} value={designation.id}>{designation.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commitment-amount">Amount per gift</Label>
              <Input id="commitment-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(value) => setFrequency(value as GivingCommitmentFrequency)}>
                <SelectTrigger aria-label="Commitment frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time pledge</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="commitment-start">Starts</Label>
                <Input id="commitment-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commitment-end">Ends (optional)</Label>
                <Input id="commitment-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>
          </div>
          {recipients.length === 0 && !recipientsQuery.loading && (
            <p className="text-sm text-muted-foreground">Add an active recipient below before creating a commitment.</p>
          )}
          <Button onClick={() => void createCommitment()} disabled={saving || !name.trim() || !recipientId || !validAmount || !startDate}>
            <Plus className="size-4" /> {saving ? "Adding..." : "Add commitment"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">Expected vs recorded</h2>
            <p className="mt-1 text-xs text-muted-foreground">Only gifts assigned to the same recipient and fund are counted.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div><Label htmlFor="giving-period-start" className="text-xs">From</Label><Input id="giving-period-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1 h-9" /></div>
            <div><Label htmlFor="giving-period-end" className="text-xs">To</Label><Input id="giving-period-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1 h-9" /></div>
            <Button variant="outline" size="sm" disabled={!periodStart || !periodEnd || periodEnd < periodStart} onClick={() => setAppliedRange({ start: periodStart, end: periodEnd })}>Apply</Button>
          </div>
        </div>
        {progressQuery.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Expected</p><p className="mt-1 font-display text-xl font-semibold">{formatCurrency(expected, currency)}</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Recorded</p><p className="mt-1 font-display text-xl font-semibold text-giving">{formatCurrency(recorded, currency)}</p></CardContent></Card>
              <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Remaining</p><p className="mt-1 font-display text-xl font-semibold">{formatCurrency(remaining, currency)}</p></CardContent></Card>
            </div>
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="giving-income-context" className="font-medium">Show income context</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optionally compare all recorded giving with income in this period. No target is assumed.
                    </p>
                  </div>
                  <Switch id="giving-income-context" checked={showIncomeContext} onCheckedChange={setShowIncomeContext} />
                </div>
                {showIncomeContext && (
                  <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Income</p><p className="mt-1 font-display text-lg font-semibold text-income">{formatCurrency(progressQuery.data.income_context.income, currency)}</p></div>
                    <div><p className="text-xs text-muted-foreground">All giving</p><p className="mt-1 font-display text-lg font-semibold text-giving">{formatCurrency(progressQuery.data.income_context.giving, currency)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Share of income</p><p className="mt-1 font-display text-lg font-semibold tabular-nums">{progressQuery.data.income_context.giving_rate === null ? "Not available" : `${progressQuery.data.income_context.giving_rate}%`}</p></div>
                    {progressQuery.data.income_context.giving_rate === null && (
                      <p className="text-xs text-muted-foreground sm:col-span-3">A percentage needs recorded income in the selected period.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {progressQuery.loading ? (
        <p className="text-sm text-muted-foreground">Loading commitments...</p>
      ) : progressQuery.error ? (
        <p className="text-sm text-destructive">{progressQuery.error}</p>
      ) : (progressQuery.data?.commitments.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No commitments yet.</p>
      ) : progressQuery.data?.commitments.map((commitment) => (
        <div key={commitment.id} className={`flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center ${commitment.is_active ? "" : "opacity-60"}`}>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{commitment.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{commitment.recipient_name}{commitment.designation_name ? ` · ${commitment.designation_name}` : " · General"} · {formatCurrency(commitment.amount, currency)} {commitment.frequency.replace("_", " ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(commitment.recorded, currency)} recorded of {formatCurrency(commitment.expected, currency)} expected in this period</p>
          </div>
          <div className="flex items-center gap-2"><Label htmlFor={`commitment-${commitment.id}`} className="text-xs text-muted-foreground">Active</Label><Switch id={`commitment-${commitment.id}`} checked={commitment.is_active} onCheckedChange={() => void toggleCommitment(commitment)} /></div>
        </div>
      ))}
    </div>
  );
}
