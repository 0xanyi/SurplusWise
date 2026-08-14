"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2 } from "lucide-react";
import { apiFetch, useWorkspaceCurrency } from "@/hooks/use-api";
import { useNotifications } from "@/hooks/use-notifications";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/panel";

export function NotificationsInbox() {
  const router = useRouter();
  const currency = useWorkspaceCurrency();
  const { data, loading, error, refresh } = useNotifications();

  const setRead = async (id: string, read: boolean) => {
    await apiFetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    });
    refresh();
  };

  const openNotification = async (id: string, href: string, unread: boolean) => {
    if (unread) await setRead(id, true);
    router.push(href);
  };

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return (
      <Card><EmptyState icon={Bell} title="Notifications unavailable" description={error ?? undefined} action={<Button variant="outline" onClick={refresh}>Retry</Button>} /></Card>
    );
  }
  if (data.notifications.length === 0) {
    return (
      <Card><EmptyState icon={Bell} title="Nothing needs your attention" description="Due money, import reviews, and budget limits will appear here." /></Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4 text-sm text-muted-foreground sm:px-6">
        {data.unread} unread · Money that needs attention
      </div>
      <ul>
        {data.notifications.map((notification) => (
          <li key={notification.id} className={cn("flex gap-3 border-b border-border/60 px-5 py-4 last:border-0 sm:px-6", !notification.read_at && "bg-obligation-surface/30")}>
            <span className={cn("mt-1 size-2 flex-none rounded-full", notification.read_at ? "bg-border" : "bg-obligation")} />
            <Link
              href={notification.href}
              onClick={(event) => {
                event.preventDefault();
                void openNotification(notification.id, notification.href, !notification.read_at);
              }}
              className="min-w-0 flex-1"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{notification.title}</p>
                <p className="font-semibold tabular-nums">{formatCurrency(notification.amount, currency)}</p>
              </div>
              <p className={cn(
                "mt-1 text-sm",
                notification.kind === "due_money" && notification.days_until_due !== null && notification.days_until_due <= 0
                  ? "text-expense"
                  : "text-muted-foreground",
              )}>
                {notification.description}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label={notification.read_at ? "Mark unread" : "Mark read"}
              onClick={() => void setRead(notification.id, !notification.read_at)}
            >
              <Check className={cn(notification.read_at ? "text-muted-foreground" : "text-income")} />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
