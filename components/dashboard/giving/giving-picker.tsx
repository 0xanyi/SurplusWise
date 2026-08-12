"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiGivingRecipient } from "@/types";

export const NO_GIVING_RECIPIENT = "__no_giving_recipient__";
export const NO_GIVING_DESIGNATION = "__no_giving_designation__";

export function GivingPicker({
  recipientId,
  designationId,
  onRecipientChange,
  onDesignationChange,
}: {
  recipientId: string;
  designationId: string;
  onRecipientChange: (value: string) => void;
  onDesignationChange: (value: string) => void;
}) {
  const { data } = useApiQuery<{ recipients: ApiGivingRecipient[] }>(
    "/api/giving-recipients?active=true",
  );
  const recipients = data?.recipients ?? [];
  const designations =
    recipients.find((recipient) => recipient.id === recipientId)?.designations ?? [];

  if (recipients.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Recipient (optional)</Label>
        <Select value={recipientId} onValueChange={onRecipientChange}>
          <SelectTrigger aria-label="Giving recipient"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_GIVING_RECIPIENT}>No recipient</SelectItem>
            {recipients.map((recipient) => (
              <SelectItem key={recipient.id} value={recipient.id}>{recipient.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {recipientId !== NO_GIVING_RECIPIENT && designations.length > 0 && (
        <div className="space-y-2">
          <Label>Fund / designation (optional)</Label>
          <Select value={designationId} onValueChange={onDesignationChange}>
            <SelectTrigger aria-label="Giving fund or designation"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GIVING_DESIGNATION}>General / undesignated</SelectItem>
              {designations.map((designation) => (
                <SelectItem key={designation.id} value={designation.id}>{designation.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
