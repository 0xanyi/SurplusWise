import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Wallet, Receipt, PieChart, Sparkles, ArrowRight, Shield, TrendingUp } from "lucide-react";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  const features = [
    {
      icon: Receipt,
      title: "AI Receipt Scanning",
      description: "Snap a photo of your receipt and let AI extract the details automatically",
    },
    {
      icon: PieChart,
      title: "Visual Analytics",
      description: "Beautiful charts and insights to understand your spending patterns",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your financial data is encrypted and never shared with third parties",
    },
    {
      icon: TrendingUp,
      title: "Budget Tracking",
      description: "Set budgets for categories and get alerts when you're close to limits",
    },
  ];

  return (
    <main className="min-h-screen gradient-hero">
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between max-w-7xl">
        <div className="flex items-center gap-2">
          <Wallet className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">SurplusWise</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/auth/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      <section className="container mx-auto px-4 pt-20 pb-32 max-w-7xl">
        <div className="max-w-3xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Finance Management</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Take Control of Your{" "}
            <span className="text-primary">Finances</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Track expenditures, manage church givings, and gain financial insights
            with AI-powered receipt scanning. Simple, secure, and smart.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/auth/signup">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8">
                Start Free Today
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-32 max-w-7xl">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-32 max-w-7xl">
        <div className="rounded-3xl bg-card border border-border p-8 md:p-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">100%</div>
              <p className="text-muted-foreground">Free to Use</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">Secure</div>
              <p className="text-muted-foreground">Bank-Level Encryption</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">Smart</div>
              <p className="text-muted-foreground">AI-Powered Insights</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="container mx-auto px-4 pb-8 max-w-7xl">
        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-5 w-5" />
            <span className="text-sm">© {new Date().getFullYear()} SurplusWise. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
