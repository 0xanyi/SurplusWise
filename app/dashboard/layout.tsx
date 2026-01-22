"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

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
     <div className="min-h-screen bg-background">
      <DashboardNav
        user={{
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        }}
      />
       <main className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">{children}</main>
    </div>
  );
}
