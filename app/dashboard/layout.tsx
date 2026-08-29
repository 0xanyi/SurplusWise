"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  DashboardMobileHeader,
  DashboardTabBar,
} from "@/components/dashboard/dashboard-mobile-nav";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { apiFetch } from "@/hooks/use-api";
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

    if (!session?.user?.id) return;

    // Seeding is per workspace, so this has to carry the active one rather than
    // defaulting to the user's first. `apiFetch` reads it straight from
    // localStorage, so it is right even on this first render, before the
    // WorkspaceProvider below has resolved.
    const seed = () => {
      apiFetch("/api/categories/seed", { method: "POST" }).catch((error) => {
        console.error("Failed to seed default categories", error);
      });
    };

    seed();

    // Mounting is not enough: switching into a workspace that has never been
    // seeded has to fill it too, otherwise it shows an empty category list
    // until the next full page load.
    window.addEventListener("workspace-changed", seed);
    return () => window.removeEventListener("workspace-changed", seed);
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
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[11px] focus:bg-primary focus:px-3.5 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <DashboardSidebar user={user} />
          <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-5 pt-4.5 lg:max-w-[1240px] lg:gap-[26px] lg:px-8 lg:pb-14 lg:pt-6">
            <DashboardMobileHeader user={user} />
            <div id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
              <Suspense
                fallback={
                  <div
                    className="flex min-h-[320px] items-center justify-center"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    <span className="sr-only">Loading dashboard</span>
                  </div>
                }
              >
                {children}
              </Suspense>
            </div>
            <DashboardTabBar />
          </main>
        </div>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
