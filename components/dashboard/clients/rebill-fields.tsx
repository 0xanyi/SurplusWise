"use client";

import Link from "next/link";
import { useApiQuery } from "@/hooks/use-api";
import { usePartyLabels } from "@/hooks/use-party-labels";
import type { ApiClient, RebillMode } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NO_CLIENT } from "./client-picker";
import { rebillModeHint } from "./rebill-mode-badge";

export { NO_CLIENT };

export interface RebillFormData {
  vendor: string;
  clientId: string;
  rebillMode: RebillMode;
  rebillAmount: string;
}

export const EMPTY_REBILL: RebillFormData = {
  vendor: "",
  clientId: NO_CLIENT,
  rebillMode: "none",
  rebillAmount: "",
};

const MODE_OPTIONS: { value: RebillMode; label: string }[] = [
  { value: "at_cost", label: "Bill it back at cost" },
  { value: "fixed", label: "Bill it back at my price" },
  { value: "bundled", label: "Covered by their retainer" },
];

/**
 * Who a recurring cost is really for, and on what terms.
 *
 * Choosing nobody forces the mode back to `none`, which is the same invariant
 * the CHECK constraint and `assertRebillShape` enforce: a rebill mode without a
 * client cannot mean anything, so the form never lets that pair be assembled.
 */
export function RebillFields({
  value,
  onChange,
  idPrefix = "outgoing",
}: {
  value: RebillFormData;
  onChange: (updates: Partial<RebillFormData>) => void;
  idPrefix?: string;
}) {
  const labels = usePartyLabels();
  const { data } = useApiQuery<{ clients: ApiClient[] }>("/api/clients?active=true");
  const clients = data?.clients ?? [];

  const attached = value.clientId !== NO_CLIENT;

  const handleClientChange = (next: string) => {
    onChange(
      next === NO_CLIENT
        ? { clientId: next, rebillMode: "none", rebillAmount: "" }
        : {
            clientId: next,
            // Attaching someone means the cost is theirs; at-cost is the common
            // case and can be changed in the next field.
            rebillMode: value.rebillMode === "none" ? "at_cost" : value.rebillMode,
          },
    );
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-vendor`}>Paid to (optional)</Label>
        <Input
          id={`${idPrefix}-vendor`}
          placeholder="e.g. Namecheap, Hetzner"
          value={value.vendor}
          onChange={(e) => onChange({ vendor: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-client`}>Carried for (optional)</Label>
        <Select value={value.clientId} onValueChange={handleClientChange}>
          <SelectTrigger id={`${idPrefix}-client`} aria-label={labels.singular}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLIENT}>My own cost</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clients.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No {labels.lowerPlural} yet.{" "}
            <Link href="/dashboard/clients" className="underline underline-offset-2">
              Add one
            </Link>{" "}
            to bill costs back.
          </p>
        )}
      </div>

      {attached && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-rebill-mode`}>How it comes back</Label>
            <Select
              value={value.rebillMode}
              onValueChange={(next) =>
                onChange({
                  rebillMode: next as RebillMode,
                  ...(next !== "fixed" && { rebillAmount: "" }),
                })
              }
            >
              <SelectTrigger id={`${idPrefix}-rebill-mode`} aria-label="Rebill terms">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {rebillModeHint(value.rebillMode)}
            </p>
          </div>

          {value.rebillMode === "fixed" && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-rebill-amount`}>What you charge</Label>
              <Input
                id={`${idPrefix}-rebill-amount`}
                type="number"
                // Matches `amountSchema`, which is positive-only; min="0" let
                // the browser pass a zero the server then rejected.
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={value.rebillAmount}
                onChange={(e) => onChange({ rebillAmount: e.target.value })}
                required
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
