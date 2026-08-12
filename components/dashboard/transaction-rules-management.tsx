"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import type { ApiClient, ApiTransactionRule, TransactionType } from "@/types";

const ANY_TYPE = "__any_type__";
const NO_CLIENT = "__no_client__";

export function TransactionRulesManagement() {
  const { toast } = useToast();
  const rulesQuery = useApiQuery<{ rules: ApiTransactionRule[] }>("/api/transaction-rules");
  const clientsQuery = useApiQuery<{ clients: ApiClient[] }>("/api/clients?active=true");
  const rules = rulesQuery.data?.rules ?? [];
  const clients = clientsQuery.data?.clients ?? [];
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [matchField, setMatchField] = useState<"payee" | "notes">("payee");
  const [matchValue, setMatchValue] = useState("");
  const [transactionType, setTransactionType] = useState(ANY_TYPE);
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [clientId, setClientId] = useState(NO_CLIENT);
  const [markReviewed, setMarkReviewed] = useState(false);
  const [priority, setPriority] = useState("100");

  const parsedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const parsedPriority = Number(priority);
  const hasValidPriority =
    Number.isInteger(parsedPriority) && parsedPriority >= 0 && parsedPriority <= 1000;
  const hasAction = Boolean(category.trim() || parsedTags.length || clientId !== NO_CLIENT || markReviewed);

  const createRule = async () => {
    if (!name.trim() || !matchValue.trim() || !hasAction || !hasValidPriority) return;
    setSaving(true);
    try {
      await apiFetch("/api/transaction-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          matchField,
          matchValue: matchValue.trim(),
          transactionType: transactionType === ANY_TYPE ? null : transactionType,
          category: category.trim() || null,
          tags: parsedTags,
          clientId: clientId === NO_CLIENT ? null : clientId,
          markReviewed,
          priority: parsedPriority,
        }),
      });
      setName("");
      setMatchField("payee");
      setMatchValue("");
      setTransactionType(ANY_TYPE);
      setCategory("");
      setTags("");
      setClientId(NO_CLIENT);
      setMarkReviewed(false);
      setPriority("100");
      rulesQuery.refresh();
      toast({ title: "Rule created", description: "It will apply to future imports." });
    } catch (error) {
      toast({
        title: "Could not create rule",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: ApiTransactionRule) => {
    try {
      await apiFetch(`/api/transaction-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.is_active }),
      });
      rulesQuery.refresh();
    } catch (error) {
      toast({
        title: "Could not update rule",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await apiFetch(`/api/transaction-rules/${id}`, { method: "DELETE" });
      rulesQuery.refresh();
      toast({ title: "Rule deleted" });
    } catch (error) {
      toast({
        title: "Could not delete rule",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-5 sm:pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input id="rule-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Coffee shops" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Match field</Label>
              <Select value={matchField} onValueChange={(value) => setMatchField(value as "payee" | "notes")}>
                <SelectTrigger aria-label="Rule match field"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payee">Payee contains</SelectItem>
                  <SelectItem value="notes">Notes contain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-match">Text to match</Label>
              <Input id="rule-match" value={matchValue} onChange={(event) => setMatchValue(event.target.value)} placeholder="cafe" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Transaction type</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger aria-label="Rule transaction type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_TYPE}>Any type</SelectItem>
                  {(["expense", "income", "giving"] as TransactionType[]).map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-category">Set category</Label>
              <Input id="rule-category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Food & Dining" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-tags">Set tags</Label>
              <Input id="rule-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="work, recurring" />
            </div>
            <div className="space-y-2">
              <Label>Set client / person</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger aria-label="Rule client"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>No client change</SelectItem>
                  {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-priority">Priority</Label>
              <Input id="rule-priority" type="number" min="0" max="1000" value={priority} onChange={(event) => setPriority(event.target.value)} />
              <p className="text-xs text-muted-foreground">Lower numbers run first; only the first match applies.</p>
              {!hasValidPriority && (
                <p className="text-xs text-destructive">Enter a whole number from 0 to 1000.</p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch id="rule-reviewed" checked={markReviewed} onCheckedChange={setMarkReviewed} />
              <Label htmlFor="rule-reviewed">Mark matching imports reviewed</Label>
            </div>
          </div>
          {!hasAction && (
            <p className="text-sm text-muted-foreground">Choose at least one action: category, tags, client, or mark reviewed.</p>
          )}
          <Button type="button" onClick={() => void createRule()} disabled={saving || !name.trim() || !matchValue.trim() || !hasAction || !hasValidPriority}>
            <Plus className="size-4" /> {saving ? "Creating..." : "Create rule"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rulesQuery.loading ? (
          <p className="rounded-xl border border-border/70 p-6 text-center text-sm text-muted-foreground">Loading transaction rules...</p>
        ) : rulesQuery.error ? (
          <p className="rounded-xl border border-destructive/40 p-6 text-center text-sm text-destructive">{rulesQuery.error}</p>
        ) : rules.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No transaction rules yet.</p>
        ) : rules.map((rule) => {
          const actions = [
            rule.category ? `category: ${rule.category}` : null,
            rule.tags.length ? `tags: ${rule.tags.join(", ")}` : null,
            rule.client_id ? `client: ${clients.find((client) => client.id === rule.client_id)?.name ?? "archived"}` : null,
            rule.mark_reviewed ? "mark reviewed" : null,
          ].filter(Boolean).join(" · ");
          return (
            <div key={rule.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{rule.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rule.transaction_type ?? "any type"} · {rule.match_field} contains “{rule.match_value}” → {actions}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Priority {rule.priority}</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={rule.is_active} onCheckedChange={() => void toggleRule(rule)} aria-label={`${rule.is_active ? "Disable" : "Enable"} ${rule.name}`} />
                <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" aria-label={`Delete ${rule.name}`} onClick={() => void deleteRule(rule.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
