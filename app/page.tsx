import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { 
  Wallet, 
  Receipt, 
  PieChart, 
  Sparkles, 
  ArrowRight, 
  Shield, 
  TrendingUp,
  CheckCircle2,
  Star
} from "lucide-react";

export default async function Home() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/dashboard");
  }

  const features = [
    {
      icon: Receipt,
      title: "AI Receipt Scanning",
      description: "Snap a photo of your receipt and let our advanced AI extract details automatically.",
      color: "text-blue-500 dark:text-blue-400",
      bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
      borderColor: "group-hover:border-blue-500/50"
    },
    {
      icon: PieChart,
      title: "Visual Analytics",
      description: "Understand your spending patterns with beautiful, interactive charts and graphs.",
      color: "text-purple-500 dark:text-purple-400",
      bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
      borderColor: "group-hover:border-purple-500/50"
    },
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "Your financial data is encrypted with state-of-the-art security protocols.",
      color: "text-emerald-500 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
      borderColor: "group-hover:border-emerald-500/50"
    },
    {
      icon: TrendingUp,
      title: "Smart Budgeting",
      description: "Set budgets for categories and receive smart alerts when you're close to limits.",
      color: "text-amber-500 dark:text-amber-400",
      bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
      borderColor: "group-hover:border-amber-500/50"
    },
  ];

  const stats = [
    { value: "10k+", label: "Active Users", icon: "👤" },
    { value: "$2M+", label: "Transactions Tracked", icon: "💰" },
    { value: "4.9", label: "App Store Rating", icon: "⭐" },
  ];

  return (
    <main className="min-h-screen flex flex-col">
      <div className="grain-overlay" aria-hidden="true" />
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-2 rounded-xl shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">SurplusWise</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="hidden sm:block">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground cursor-pointer">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/25 hover:shadow-primary/40 cursor-pointer cta-glow">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 gradient-hero relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-sm font-medium text-muted-foreground animate-slide-up" style={{ animationDelay: "100ms" }}>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>The future of personal finance is here</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight animate-slide-up" style={{ animationDelay: "200ms" }}>
              Master Your Money <br className="hidden md:block" />
              <span className="text-gradient">Without the Stress</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: "300ms" }}>
              Track expenditures, manage church givings, and gain deep financial insights with AI-powered receipt scanning. Simple, secure, and smart.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 animate-slide-up" style={{ animationDelay: "400ms" }}>
              <Link href="/auth/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8 h-14 rounded-full shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300 cursor-pointer cta-glow font-semibold">
                  Start for Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 h-14 rounded-full glass-card hover:scale-105 transition-all duration-300 cursor-pointer font-semibold border-border/50 hover:border-primary/50">
                  Live Demo
                </Button>
              </Link>
            </div>

            <div className="pt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground animate-slide-up" style={{ animationDelay: "500ms" }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                <span>Free 14-day trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Abstract background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: "8s" }}></div>
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -z-10"></div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30 dark:bg-muted/10 relative">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-block text-sm font-semibold text-primary mb-4 tracking-wide uppercase">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-muted-foreground text-lg">
              Powerful features to help you track, analyze, and optimize your financial life.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`group cursor-pointer p-6 rounded-3xl glass-card border border-border/50 ${feature.borderColor} hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden`}
              >
                <div className={`h-14 w-14 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                  <feature.icon className={`h-7 w-7 ${feature.color}`} />
                </div>
                <h3 className="font-bold text-xl mb-3 group-hover:text-primary transition-colors duration-200">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                
                {/* Hover arrow indicator */}
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                  <span>Learn more</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
                
                {/* Decoration */}
                <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl group-hover:from-primary/15 transition-all duration-500"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="rounded-[2.5rem] stat-card p-8 md:p-16 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/5 dark:from-primary/20 dark:to-purple-500/10"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="grid md:grid-cols-3 gap-12 relative z-10">
              {stats.map((stat, index) => (
                <div key={stat.label} className="text-center space-y-3 group cursor-default">
                  <div className="text-4xl mb-2">{stat.icon}</div>
                  <div className="text-5xl md:text-6xl font-black text-foreground group-hover:text-primary transition-colors duration-300 tabular-nums">{stat.value}</div>
                  <p className="text-lg font-medium text-muted-foreground">{stat.label}</p>
                  {index === 2 && (
                    <div className="flex justify-center gap-0.5 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-32 pt-10">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="glass-card rounded-[2.5rem] p-12 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10"></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to take control?</h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join thousands of users who are already managing their finances smarter with SurplusWise.
              </p>
              <Link href="/auth/signup">
                <Button size="lg" className="h-16 px-12 rounded-full text-lg shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer cta-glow font-semibold">
                  Get Started Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              
              <p className="mt-6 text-sm text-muted-foreground">
                No credit card required • Free 14-day trial
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/20 dark:bg-muted/5">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="bg-gradient-to-br from-primary to-primary/80 p-2 rounded-lg shadow-md shadow-primary/20">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">SurplusWise</span>
            </div>
            
            <div className="flex gap-8 text-sm font-medium text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors cursor-pointer">Features</Link>
              <Link href="#" className="hover:text-primary transition-colors cursor-pointer">Pricing</Link>
              <Link href="#" className="hover:text-primary transition-colors cursor-pointer">About</Link>
              <Link href="#" className="hover:text-primary transition-colors cursor-pointer">Contact</Link>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SurplusWise. All rights reserved.
              <span className="ml-2 text-xs opacity-60">v0.6.0</span>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
