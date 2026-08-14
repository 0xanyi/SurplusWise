"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

interface EmailStatus {
  configured: boolean;
  enabled: boolean;
  email: string;
}

export function EmailNotificationSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await apiFetch<EmailStatus>("/api/email-notifications"));
    } catch (error) {
      toast({
        title: "Email reminders unavailable",
        description: error instanceof Error ? error.message : "Failed to load email settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    window.addEventListener("workspace-changed", load);
    return () => window.removeEventListener("workspace-changed", load);
  }, [load]);

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      setStatus(await apiFetch<EmailStatus>("/api/email-notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }));
      toast({
        title: enabled ? "Email reminders enabled" : "Email reminders disabled",
        description: enabled
          ? "Unread reminders will be sent to your account email."
          : "Email delivery is off for this workspace.",
      });
    } catch (error) {
      toast({
        title: "Could not update email reminders",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const unavailable = status && !status.configured
    ? "SMTP has not been configured by the server administrator."
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold leading-none tracking-[-0.015em]">
            Email reminders
          </h2>
        </div>
        <CardDescription>
          Receive one digest containing unread due money, import reviews, and budget limits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 border-t border-border/60 py-3.5">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="email-notifications">Email this workspace&apos;s reminders</Label>
            <p className="truncate text-sm text-muted-foreground">
              {unavailable ?? (status ? `Send to ${status.email}` : "Uses your account email.")}
            </p>
          </div>
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : (
            <Switch
              id="email-notifications"
              checked={status?.enabled ?? false}
              disabled={saving || (!status?.enabled && Boolean(unavailable))}
              onCheckedChange={(value) => void toggle(value)}
              aria-describedby="email-notification-state"
            />
          )}
        </div>
        <p id="email-notification-state" className="sr-only">
          Email reminders are {status?.enabled ? "enabled" : "disabled"} for this workspace.
        </p>
      </CardContent>
    </Card>
  );
}
