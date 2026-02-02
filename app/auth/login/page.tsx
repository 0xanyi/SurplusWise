"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

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
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      {/* Left Side - Hero/Visuals */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-10 text-white relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/20 blur-[100px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-purple-600/20 blur-[100px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5 w-fit">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/10">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight">SurplusWise</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-8 max-w-lg">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Master your money with clarity and confidence.
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed">
              Join thousands of users who are taking control of their financial future. 
              Track expenses, manage givings, and visualize your wealth in one beautiful dashboard.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-zinc-300">AI-powered receipt scanning</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-zinc-300">Smart budget tracking & alerts</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-zinc-300">Beautiful financial reports</span>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} SurplusWise. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex items-center justify-center p-8 bg-background relative">
        <div className="grain-overlay lg:hidden" aria-hidden="true" />
        
        <div className="w-full max-w-[400px] space-y-8 relative z-10">
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <Link href="/" className="lg:hidden flex items-center justify-center gap-2.5 mb-6 w-fit mx-auto">
              <div className="bg-primary/10 p-2 rounded-xl">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <span className="font-bold text-2xl">SurplusWise</span>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">
              Enter your email below to sign in to your account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link 
                  href="#" 
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    toast({ description: "Password reset coming soon" });
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-muted/30"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                New to SurplusWise?
              </span>
            </div>
          </div>

          <div className="text-center">
            <Link 
              href="/auth/signup" 
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-muted hover:text-primary h-11 px-8 w-full border border-input bg-background"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
