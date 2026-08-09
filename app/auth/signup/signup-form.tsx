"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

export function SignupForm() {
  const [setupToken, setSetupToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();

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
      const { error } = await authClient.signUp.email(
        { email, password, name },
        { headers: { "x-sika-setup-token": setupToken } },
      );
      if (error) throw new Error(error.message);

      toast({ title: "Success", description: "Sika is set up. Please sign in." });
      router.push("/auth/login");
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to set up Sika";
      toast({ title: "Error", description: message, variant: "destructive" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} className="mt-8 space-y-3.5">
      <div className="space-y-1.5">
        <Label htmlFor="setupToken">Setup token</Label>
        <Input
          id="setupToken"
          type="password"
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          placeholder="Token configured by the server operator"
          autoComplete="one-time-code"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
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
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat password"
          autoComplete="new-password"
          required
        />
      </div>

      <Button type="submit" size="lg" className="mt-1.5 w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Set up Sika
      </Button>
    </form>
  );
}
