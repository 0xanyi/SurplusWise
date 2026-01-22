import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

export const metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="grain-overlay" aria-hidden="true" />
      
      <div className="max-w-2xl mx-auto text-center space-y-8 relative z-10">
        {/* Large 404 */}
        <div className="relative">
          <h1 className="text-[150px] md:text-[200px] font-black text-transparent bg-clip-text bg-gradient-to-br from-primary/30 to-purple-500/30 dark:from-primary/20 dark:to-purple-500/20 leading-none select-none">
            404
          </h1>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: "4s" }}></div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold">Page Not Found</h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Oops! The page you&apos;re looking for seems to have wandered off. 
            Let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/">
            <Button size="lg" className="w-full sm:w-auto gap-2 rounded-full shadow-lg hover:scale-105 transition-all">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 rounded-full hover:scale-105 transition-all">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="pt-8">
          <p className="text-sm text-muted-foreground mb-4">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/dashboard" className="text-primary hover:underline">
              Dashboard
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link href="/dashboard/transactions" className="text-primary hover:underline">
              Transactions
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link href="/dashboard/reports" className="text-primary hover:underline">
              Reports
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link href="/dashboard/settings" className="text-primary hover:underline">
              Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
