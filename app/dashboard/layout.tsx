"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DashboardNav from "@/components/dashboard/dashboard-nav";
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

    // Default categories are now seeded server-side on the first
    // GET /api/categories call, so no explicit mutation is needed.
    if (session?.user?.id) {
      fetch("/api/categories").catch((error) => {
        console.error("Failed to ensure default categories", error);
      });
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
      <main className="container mx-auto max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
