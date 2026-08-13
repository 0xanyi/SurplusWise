"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { apiFetch } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PushStatus {
  configured: boolean;
  publicKey: string | null;
  enabled: boolean;
  deviceEnabled: boolean;
}

function applicationServerKey(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const bytes = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function browserSupport() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushNotificationSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const serverStatus = await apiFetch<PushStatus>("/api/push-subscriptions");
      const isSupported = browserSupport();
      setSupported(isSupported);
      if (!isSupported) {
        setStatus(serverStatus);
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setStatus(serverStatus);
        return;
      }
      setStatus(await apiFetch<PushStatus>("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", endpoint: subscription.endpoint }),
      }));
    } catch (error) {
      toast({
        title: "Push notifications unavailable",
        description: error instanceof Error ? error.message : "Failed to load push notification settings",
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

  const enable = async () => {
    if (!status?.publicKey || !supported) return;
    const permission = await window.Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? "Notifications are blocked in this browser's site settings."
          : "Notification permission was not granted.",
      );
    }

    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(status.publicKey),
      });
    }
    setStatus(await apiFetch<PushStatus>("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON() }),
    }));
  };

  const disable = async () => {
    const registration = supported
      ? await navigator.serviceWorker.getRegistration("/")
      : undefined;
    const subscription = await registration?.pushManager.getSubscription();
    setStatus(await apiFetch<PushStatus>("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", endpoint: subscription?.endpoint }),
    }));
    await subscription?.unsubscribe();
  };

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      if (enabled) await enable();
      else await disable();
      toast({
        title: enabled ? "Push notifications enabled" : "Push notifications disabled",
        description: enabled
          ? "This device will receive unread reminders for this workspace."
          : "Push delivery is off for this workspace.",
      });
    } catch (error) {
      toast({
        title: "Could not update push notifications",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const unavailableReason = supported === false
    ? "This browser does not support Web Push, or the site is not using HTTPS."
    : !status?.configured
      ? "Web Push has not been configured by the server administrator."
      : window.Notification.permission === "denied"
        ? "Notifications are blocked in this browser's site settings."
        : null;
  const checked = Boolean(status?.enabled && status.deviceEnabled);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold leading-none tracking-[-0.015em]">
            Browser reminders
          </h2>
        </div>
        <CardDescription>
          Receive notifications for unread due money and imported transactions needing review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 border-t border-border/60 py-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="push-notifications">Notify this device</Label>
            <p className="text-sm text-muted-foreground">
              {unavailableReason ?? (status?.enabled && !status.deviceEnabled
                ? "Enabled for this workspace on another device."
                : "This is an explicit opt-in for the active workspace.")}
            </p>
          </div>
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : (
            <Switch
              id="push-notifications"
              checked={checked}
              disabled={saving || (!checked && Boolean(unavailableReason))}
              onCheckedChange={(value) => void toggle(value)}
              aria-describedby="push-notification-state"
            />
          )}
        </div>
        <p id="push-notification-state" className="sr-only">
          Push notifications are {checked ? "enabled" : "disabled"} for this device.
        </p>
      </CardContent>
    </Card>
  );
}
