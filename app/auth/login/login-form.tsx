"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message);

      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to log in";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em]">
        Welcome back
      </h1>
      <p className="mt-2.5 text-sm text-muted-foreground">
        Sign in to your ledger.
      </p>

      <form onSubmit={handleLogin} className="mt-8 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="mt-1.5 w-full"
          disabled={loading}
        >
          {loading && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </>
  );
}
