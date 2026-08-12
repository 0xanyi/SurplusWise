"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Loader2, Plus } from "lucide-react";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { usePartyLabels } from "@/hooks/use-party-labels";
import { useToast } from "@/hooks/use-toast";
import type { ApiClient } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, StatTile } from "@/components/dashboard/panel";
import { ClientFormFields, type ClientFormData } from "./client-form-fields";

interface ClientsResponse {
  clients: ApiClient[];
  totals: {
    fronted: number;
    received: number;
    not_yet_recovered: number;
    monthly_fronted: number;
  };
}

const EMPTY_FORM: ClientFormData = { name: "", contactEmail: "", notes: "" };

export function ClientsManagement() {
  const labels = usePartyLabels();
  const { toast } = useToast();
  const { data, loading, error, refresh } =
    useApiQuery<ClientsResponse>("/api/clients");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>(EMPTY_FORM);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      await apiFetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          contactEmail: formData.contactEmail.trim() || null,
          notes: formData.notes.trim() || null,
        }),
      });
      toast({ title: "Added", description: `${formData.name.trim()} added` });
      setIsAddOpen(false);
      setFormData(EMPTY_FORM);
      refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || data === undefined) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {error ?? `Failed to load ${labels.lowerPlural}.`}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const clients = data.clients;

  const addDialog = (
    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 size-4" />
          Add {labels.lowerSingular}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add {labels.lowerSingular}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <ClientFormFields
            formData={formData}
            labels={labels}
            onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
          />
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
  );

  if (clients.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <EmptyState
            icon={Building2}
            title={`No ${labels.lowerPlural} yet`}
            description={labels.emptyBody}
            action={addDialog}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Fronted per month"
          value={formatCurrency(data.totals.monthly_fronted)}
          note={`across ${clients.length} ${
            clients.length === 1 ? labels.lowerSingular : labels.lowerPlural
          }`}
        />
        <StatTile
          label="Received"
          value={formatCurrency(data.totals.received)}
          tone="text-income"
        />
        <StatTile
          label="Not yet recovered"
          value={formatCurrency(data.totals.not_yet_recovered)}
          // Amber for money owed to you, the same token loans given uses.
          tone={data.totals.not_yet_recovered > 0 ? "text-obligation" : undefined}
          note={
            data.totals.not_yet_recovered > 0
              ? "paid out, not yet billed back"
              : "all costs recovered"
          }
        />
      </div>

      {addDialog}

      <div className="grid gap-3 md:grid-cols-2">
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: ApiClient }) {
  const outstanding = client.not_yet_recovered > 0;

  return (
    <Link
      href={`/dashboard/clients/${client.id}`}
      className="group rounded-[18px] border border-border/70 bg-card p-5 transition-colors hover:border-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold leading-none tracking-[-0.015em]">
            {client.name}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {client.service_count === 0
              ? "No recurring services"
              : `${client.service_count} recurring ${
                  client.service_count === 1 ? "service" : "services"
                } · ${formatCurrency(client.monthly_fronted)}/mo`}
          </p>
        </div>
        <ChevronRight className="size-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Fronted</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-expense">
            {formatCurrency(client.fronted)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Received</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-income">
            {formatCurrency(client.received)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-border/60 pt-3">
        {outstanding ? (
          <p className="text-xs font-medium text-obligation tabular-nums">
            {formatCurrency(client.not_yet_recovered)} not yet recovered
          </p>
        ) : (
          // Margin stays neutral ink: money kept is not giving, and "up" is
          // not a colour in this system.
          <p className="text-xs font-medium tabular-nums">
            {client.margin >= 0 ? "Margin " : "Behind by "}
            {formatCurrency(Math.abs(client.margin))}
          </p>
        )}
      </div>
    </Link>
  );
}
