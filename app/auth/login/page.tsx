"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) throw new Error(error.message);

      toast({
        title: "Success",
        description: "Logged in successfully!",
      });

      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to login";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero relative">
      <div className="grain-overlay" aria-hidden="true" />
      <div className="w-full max-w-md animate-scale-in relative z-10">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8 cursor-pointer group">
          <div className="bg-gradient-to-br from-primary to-primary/80 p-2.5 rounded-xl shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl group-hover:text-primary transition-colors">SurplusWise</span>
        </Link>
        
        <Card className="glass-card border-border/30 shadow-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button type="submit" className="w-full h-11 font-semibold cursor-pointer cta-glow" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-primary font-semibold hover:underline cursor-pointer"
              >
                Sign up
              </Link>
            </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
