"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  DashboardMobileHeader,
  DashboardTabBar,
} from "@/components/dashboard/dashboard-mobile-nav";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { authClient } from "@/lib/auth-client";
import { NotificationsProvider } from "@/hooks/use-notifications";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/auth/login");
      return;
    }

    if (session?.user?.id) {
      fetch("/api/categories/seed", { method: "POST" }).catch((error) => {
        console.error("Failed to seed default categories", error);
      });
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };

  return (
    <WorkspaceProvider>
      <NotificationsProvider>
        <div className="flex min-h-screen bg-background">
          <DashboardSidebar user={user} />
          {/* max-w caps the measure on very wide screens so the content column
              never outruns the sidebar it sits beside. */}
          <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-5 pt-4.5 lg:max-w-[1240px] lg:gap-[26px] lg:px-8 lg:pb-14 lg:pt-6">
            <DashboardMobileHeader user={user} />
            {children}
            <DashboardTabBar />
          </main>
        </div>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
