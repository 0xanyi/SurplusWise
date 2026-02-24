import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth-server";

export default async function Home() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Wallet className="size-5 text-primary" />
            </div>
            <span className="font-semibold text-lg">SurplusWise</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="container mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Simple money tracking for everyday life
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Track your income, expenses, and giving in one place. No clutter, no noise —
            just the numbers you need to stay consistent.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Create free account
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                I already have an account
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border p-5">
            <h2 className="font-medium">Quick entry</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add income, expenses, or giving in seconds.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <h2 className="font-medium">Clear overview</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              See this month&apos;s totals and your current balance at a glance.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <h2 className="font-medium">Optional receipt scan</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use AI receipt scanning when you need it.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Personal finance focused
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Built for daily use
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Income • Expense • Giving
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
