"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PartyLabels } from "@/lib/party-labels";

export interface ClientFormData {
  name: string;
  contactEmail: string;
  notes: string;
}

interface ClientFormFieldsProps {
  formData: ClientFormData;
  labels: PartyLabels;
  onChange: (updates: Partial<ClientFormData>) => void;
}

export function ClientFormFields({
  formData,
  labels,
  onChange,
}: ClientFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client-name">Name</Label>
        <Input
          id="client-name"
          placeholder={labels.singular === "Client" ? "e.g. Acme Ltd" : "e.g. Ama"}
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-email">Email (optional)</Label>
        <Input
          id="client-email"
          type="email"
          placeholder="billing@example.com"
          value={formData.contactEmail}
          onChange={(e) => onChange({ contactEmail: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="client-notes">Notes (optional)</Label>
        <Textarea
          id="client-notes"
          rows={3}
          placeholder="What you do for them, billing terms, anything worth remembering"
          value={formData.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
