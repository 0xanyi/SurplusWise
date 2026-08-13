"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import type { ApiGivingRecipient } from "@/types";

export function GivingManagement() {
  const { toast } = useToast();
  const query = useApiQuery<{ recipients: ApiGivingRecipient[] }>("/api/giving-recipients");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [designationNames, setDesignationNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const createRecipient = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/api/giving-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), notes: notes.trim() || null }),
      });
      setName("");
      setNotes("");
      query.refresh();
      window.dispatchEvent(new Event("giving-recipients-changed"));
      toast({ title: "Recipient added" });
    } catch (error) {
      toast({ title: "Could not add recipient", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addDesignation = async (recipientId: string) => {
    const designationName = designationNames[recipientId]?.trim();
    if (!designationName) return;
    try {
      await apiFetch("/api/giving-designations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, name: designationName }),
      });
      setDesignationNames((current) => ({ ...current, [recipientId]: "" }));
      query.refresh();
      window.dispatchEvent(new Event("giving-recipients-changed"));
      toast({ title: "Fund added" });
    } catch (error) {
      toast({ title: "Could not add fund", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const toggle = async (path: string, isActive: boolean) => {
    try {
      await apiFetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      query.refresh();
      window.dispatchEvent(new Event("giving-recipients-changed"));
    } catch (error) {
      toast({ title: "Could not update giving record", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-5 sm:pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Recipient name</Label>
              <Input id="recipient-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Community Church" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-notes">Notes (optional)</Label>
              <Textarea id="recipient-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Private reference notes" rows={2} maxLength={1000} />
            </div>
          </div>
          <Button onClick={() => void createRecipient()} disabled={saving || !name.trim()}>
            <Plus className="size-4" /> {saving ? "Adding..." : "Add recipient"}
          </Button>
        </CardContent>
      </Card>

      {query.loading ? (
        <p className="text-sm text-muted-foreground">Loading recipients...</p>
      ) : query.error ? (
        <p className="text-sm text-destructive">{query.error}</p>
      ) : (query.data?.recipients.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No giving recipients yet.</p>
      ) : query.data?.recipients.map((recipient) => (
        <Card key={recipient.id} className={!recipient.is_active ? "opacity-65" : undefined}>
          <CardContent className="space-y-4 pt-5 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display font-semibold">{recipient.name}</h2>
                {recipient.notes && <p className="mt-1 text-sm text-muted-foreground">{recipient.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`recipient-${recipient.id}`} className="text-xs text-muted-foreground">Active</Label>
                <Switch id={`recipient-${recipient.id}`} checked={recipient.is_active} onCheckedChange={() => void toggle(`/api/giving-recipients/${recipient.id}`, recipient.is_active)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {recipient.designations.map((designation) => (
                <button
                  type="button"
                  key={designation.id}
                  onClick={() => void toggle(`/api/giving-designations/${designation.id}`, designation.is_active)}
                  className={`rounded-full border px-3 py-1 text-xs ${designation.is_active ? "bg-giving-surface text-giving" : "text-muted-foreground line-through"}`}
                  aria-label={`${designation.is_active ? "Archive" : "Restore"} ${designation.name}`}
                >
                  {designation.name}
                </button>
              ))}
            </div>
            <div className="flex max-w-md gap-2">
              <Input value={designationNames[recipient.id] ?? ""} onChange={(event) => setDesignationNames((current) => ({ ...current, [recipient.id]: event.target.value }))} placeholder="Add fund or designation" maxLength={120} aria-label={`New fund for ${recipient.name}`} disabled={!recipient.is_active} />
              <Button variant="outline" onClick={() => void addDesignation(recipient.id)} disabled={!recipient.is_active || !designationNames[recipient.id]?.trim()}>Add</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
