"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    if (password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.signUp.email({ email, password, name });
      if (error) throw new Error(error.message);

      toast({ title: "Success", description: "Account created. Please sign in." });
      router.push("/auth/login");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create account";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em]">
        Create account
      </h1>
      <p className="mt-2.5 text-sm text-muted-foreground">
        Start tracking your income, expenses, and giving.
      </p>

      <form onSubmit={handleSignup} className="mt-8 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
            required
          />
        </div>

        <Button type="submit" size="lg" className="mt-1.5 w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="mt-7 text-[13.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
