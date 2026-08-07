import Link from "next/link";
import { Wallet } from "lucide-react";

export function DashboardFooter() {
  return (
    <footer className="border-t border-border/50 bg-background/50 backdrop-blur-xl mt-auto">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="size-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Sika</span>
          </div>
          
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-primary transition-colors">Help Center</Link>
            <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Sika is free and open source under the{" "}
            <Link
              href="https://github.com/tickideasintl/sika/blob/main/LICENSE"
              className="hover:text-primary transition-colors underline underline-offset-4"
            >
              MIT License
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
