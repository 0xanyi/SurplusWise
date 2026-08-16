"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function AcceptInvitation({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const accept = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line no-restricted-syntax -- the invitation token names the workspace being joined; the user has no active workspace here yet.
      const response = await fetch("/api/workspace-invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Failed to accept invitation");
      toast({ title: "Workspace joined" });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not join workspace",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" size="lg" className="mt-8 w-full" disabled={loading} onClick={() => void accept()}>
      {loading && <Loader2 className="animate-spin" />}
      Accept invitation
    </Button>
  );
}
