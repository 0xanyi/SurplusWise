import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SikaLogo } from "@/components/sika-logo";
import { isAuthenticated } from "@/lib/auth-server";

const pillars = [
  {
    title: "Entry in three seconds",
    description:
      "Type, amount, category. One row, always at the top of the page.",
  },
  {
    title: "Giving is its own kind of money",
    description:
      "Tithes and partnership are tracked as a peer of income and expense, never buried in a category.",
  },
  {
    title: "Optional receipt scanning",
    description:
      "Bring your own key, or a local Ollama. Off until you turn it on.",
  },
];

const features = [
  {
    title: "Personal and business, separated",
    description: "Workspaces keep the two sets of books fully isolated.",
  },
  {
    title: "Budgets, debts, loans, investments",
    description: "One net-worth figure that accounts for all of it.",
  },
  {
    title: "Your server, your data",
    description: "Docker compose up. No third-party calls by default.",
  },
];

export default async function Home() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex h-[78px] max-w-[1080px] items-center justify-between px-5 sm:px-8">
        <SikaLogo />
        <div className="flex items-center gap-2.5">
          <Link
            href="/auth/login"
            className="text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild>
            <Link href="/auth/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-[1080px] px-5 pb-8 pt-9 sm:px-8 sm:pb-10 sm:pt-[70px]">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-brand">
          Self-hosted · MIT licensed
        </p>
        <h1 className="mt-5 max-w-[16ch] font-display text-[40px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-[76px]">
          A quiet ledger for your money.
        </h1>
        <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
          Income, expenses and giving in one place. Runs on your own server.
          Nothing leaves it unless you say so.
        </p>

        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
          <Button asChild size="xl">
            <Link href="/auth/signup">
              Create free account
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link href="/auth/login">I already have an account</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-5 pb-8 sm:px-8">
        <div className="grid items-center gap-6 rounded-[22px] border border-border/70 bg-card p-6 sm:p-7 lg:grid-cols-2">
          {/* An illustration of the product, not live data. */}
          <div className="rounded-2xl bg-hero p-6 sm:p-7">
            <p className="text-xs text-hero-accent">Net position · last 30 days</p>
            <p className="mt-2.5 font-display text-[42px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-hero-ink sm:text-[52px]">
              £977.50
            </p>
            <div className="mt-5 flex h-2 gap-0.5" aria-hidden="true">
              <div className="w-[67%] rounded-full bg-expense" />
              <div className="w-[10%] rounded-full bg-giving" />
              <div className="w-[23%] rounded-full bg-hero-ink/25" />
            </div>
            <p className="mt-3 text-[12.5px] text-hero-muted">
              Spent 67% · Given 10% · Kept 23%
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {pillars.map((pillar) => (
              <div key={pillar.title}>
                <h2 className="font-display text-base font-semibold">
                  {pillar.title}
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1080px] gap-3 px-5 pb-20 sm:grid-cols-3 sm:px-8">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-border/70 p-5 sm:px-[22px]"
          >
            <h2 className="font-display text-[15px] font-semibold">
              {feature.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
