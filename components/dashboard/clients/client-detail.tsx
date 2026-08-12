"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Loader2,
  Mail,
  Repeat,
  Trash2,
} from "lucide-react";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { usePartyLabels } from "@/hooks/use-party-labels";
import { useToast } from "@/hooks/use-toast";
import type { ApiClient, ApiClientService, TransactionType } from "@/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { formatSignedAmount, moneyTypeTone } from "@/lib/money-type";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, StatTile } from "@/components/dashboard/panel";
import { ClientFormFields, type ClientFormData } from "./client-form-fields";
import { RebillModeBadge } from "./rebill-mode-badge";

interface ClientActivity {
  id: string;
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  notes: string | null;
}

interface ClientDetailResponse {
  client: ApiClient;
  services: ApiClientService[];
  activity: ClientActivity[];
  activity_total: number;
}

export function ClientDetail({ clientId }: { clientId: string }) {
  const labels = usePartyLabels();
  const router = useRouter();
  const { toast } = useToast();
  const { data, loading, error, refresh } = useApiQuery<ClientDetailResponse>(
    `/api/clients/${clientId}`,
  );

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    name: "",
    contactEmail: "",
    notes: "",
  });

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
            {error ?? `Failed to load this ${labels.lowerSingular}.`}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { client, services, activity } = data;
  const outstanding = client.not_yet_recovered > 0;
  const hiddenActivity = data.activity_total - activity.length;

  const openEdit = () => {
    setFormData({
      name: client.name,
      contactEmail: client.contact_email ?? "",
      notes: client.notes ?? "",
    });
    setIsEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          contactEmail: formData.contactEmail.trim() || null,
          notes: formData.notes.trim() || null,
        }),
      });
      toast({ title: "Saved", description: "Details updated" });
      setIsEditOpen(false);
      refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const warning =
      services.length > 0
        ? `Delete ${client.name}? Their ${services.length} recurring ${
            services.length === 1 ? "cost stays" : "costs stay"
          } in your outgoings and become your own overhead.`
        : `Delete ${client.name}? Any money already recorded stays in the ledger.`;
    if (!confirm(warning)) return;

    try {
      await apiFetch(`/api/clients/${clientId}`, { method: "DELETE" });
      toast({ title: "Deleted", description: `${client.name} removed` });
      router.push("/dashboard/clients");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {labels.plural}
        </Link>
        <div className="mt-1.5 flex flex-col gap-3 min-[860px]:flex-row min-[860px]:items-end min-[860px]:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[25px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[31px]">
              {client.name}
            </h1>
            {client.contact_email && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-3.5" />
                {client.contact_email}
              </p>
            )}
          </div>
          <div className="flex flex-none items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Edit2 className="mr-2 size-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label={`Delete ${client.name}`}
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/*
        The anchor figure is whichever question is live: money still owed if
        there is any, otherwise what the relationship has been worth. Both are
        stated in words as well as figures — neither reads by colour alone.
      */}
      <div className="rounded-[20px] border border-border/70 bg-card p-6">
        <p className="text-xs text-muted-foreground">
          {outstanding ? "Not yet recovered" : "Margin to date"}
        </p>
        <p
          className={`mt-2 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[44px] ${
            outstanding ? "text-obligation" : ""
          }`}
        >
          {formatCurrency(
            outstanding ? client.not_yet_recovered : Math.abs(client.margin),
          )}
        </p>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          {outstanding
            ? `You have paid this out on their behalf and it has not come back yet. ${formatCurrency(
                client.received,
              )} received against ${formatCurrency(
                client.expected_recovery,
              )} expected.`
            : client.margin >= 0
              ? `${formatCurrency(client.received)} received, ${formatCurrency(
                  client.fronted,
                )} paid out on their behalf.`
              : `They have cost more than they have paid: ${formatCurrency(
                  client.fronted,
                )} out against ${formatCurrency(client.received)} in.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Fronted"
          value={formatCurrency(client.fronted)}
          tone="text-expense"
        />
        <StatTile
          label="Received"
          value={formatCurrency(client.received)}
          tone="text-income"
        />
        <StatTile
          label="Per month"
          value={formatCurrency(client.monthly_fronted)}
          note={`${services.length} recurring ${services.length === 1 ? "service" : "services"}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Services carried for them</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {services.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="Nothing carried yet"
              description={`Attach a recurring outgoing to this ${labels.lowerSingular} to track what you pay on their behalf.`}
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/outgoings">Go to outgoings</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-start justify-between gap-4 px-5 py-3.5 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{service.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <RebillModeBadge mode={service.rebill_mode} />
                      {service.vendor && <span>via {service.vendor}</span>}
                      <span>day {service.day_of_month}</span>
                      {!service.is_active && <span>· paused</span>}
                    </p>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-[13px] font-semibold tabular-nums text-expense">
                      {formatCurrency(service.amount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {service.expected_per_cycle === null
                        ? "no separate charge"
                        : `bills ${formatCurrency(service.expected_per_cycle)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Attributed activity</CardTitle>
          {hiddenActivity > 0 && (
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
              latest {activity.length} of {data.activity_total}
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No transactions attributed"
              description={`Tag a transaction to this ${labels.lowerSingular} to see it here.`}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {activity.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{row.category}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(row.date)}
                      {row.notes && ` · ${row.notes}`}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "flex-none text-[13px] font-semibold tabular-nums",
                      moneyTypeTone(row.type).text,
                    )}
                  >
                    {formatSignedAmount(row.type, row.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {client.notes}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {labels.lowerSingular}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <ClientFormFields
              formData={formData}
              labels={labels}
              onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
            />
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
