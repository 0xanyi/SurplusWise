"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // Global keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "d",
      ctrl: true,
      action: () => router.push("/dashboard"),
      description: "Go to Dashboard",
    },
    {
      key: "t",
      ctrl: true,
      action: () => router.push("/dashboard/transactions"),
      description: "Go to Transactions",
    },
    {
      key: "r",
      ctrl: true,
      action: () => router.push("/dashboard/reports"),
      description: "Go to Reports",
    },
    {
      key: ",",
      ctrl: true,
      action: () => router.push("/dashboard/settings"),
      description: "Go to Settings",
    },
  ]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/auth/login");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
     <div className="min-h-screen bg-background flex flex-col">
      <DashboardNav
        user={{
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        }}
      />
       <main className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl flex-1">{children}</main>
       <DashboardFooter />
       <KeyboardShortcutsDialog />
    </div>
  );
}
