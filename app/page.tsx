import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold text-primary">SurplusWise</h1>
        <p className="text-xl text-muted-foreground">
          Personal Finance Management Made Simple
        </p>
        <p className="text-base text-muted-foreground">
          Track expenditures, manage church givings, and gain financial insights
          with AI-powered receipt scanning.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link href="/auth/signup">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="secondary" size="lg">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
