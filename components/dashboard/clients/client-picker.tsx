"use client";

import { useApiQuery } from "@/hooks/use-api";
import { usePartyLabels } from "@/hooks/use-party-labels";
import type { ApiClient } from "@/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The sentinel the Select uses for "nobody": Radix forbids an empty value. */
export const NO_CLIENT = "__none__";

/**
 * Attribution, not classification.
 *
 * Tagging a transaction to a client says whose money this was, and nothing
 * about the money type — an expense stays an expense and income stays income,
 * so the ledger never nets a recovery against the cost that earned it.
 * Renders nothing when the workspace has no clients, so the form it sits in
 * does not grow a dead field.
 */
export function ClientPicker({
  value,
  onChange,
  id = "transaction-client",
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
}) {
  const labels = usePartyLabels();
  const { data } = useApiQuery<{ clients: ApiClient[] }>("/api/clients?active=true");
  const clients = data?.clients ?? [];

  if (clients.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{labels.singular} (optional)</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={labels.singular}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CLIENT}>Not attributed</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
