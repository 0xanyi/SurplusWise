"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { authClient } from "@/lib/auth-client";

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

  return (
    <WorkspaceProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <DashboardNav
          user={{
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
          }}
        />
        <main className="container mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
