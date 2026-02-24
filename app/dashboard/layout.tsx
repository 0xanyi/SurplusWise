"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const ensureDefaultCategories = useMutation(api.categories.ensureDefaults);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/auth/login");
      return;
    }

    if (session?.user?.id) {
      ensureDefaultCategories({}).catch((error) => {
        console.error("Failed to ensure default categories", error);
      });
    }
  }, [session, isPending, router, ensureDefaultCategories]);

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
