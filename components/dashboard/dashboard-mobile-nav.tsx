"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { SikaLogo } from "@/components/sika-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { mobileTabItems } from "@/components/dashboard/nav-items";
import { useWorkspace } from "@/contexts/workspace-context";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileNavUser {
  id: string;
  email: string;
  name: string;
}

/** Logo, workspace, theme and account — the chrome the sidebar carries on desktop. */
export function DashboardMobileHeader({ user }: { user: MobileNavUser }) {
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const { toast } = useToast();
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  const handleLogout = async () => {
    await authClient.signOut();
    toast({ title: "Logged out", description: "You have been logged out." });
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div className="flex items-center justify-between gap-3 lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/dashboard">
          <SikaLogo size="sm" />
        </Link>
        {activeWorkspace && (
          <span className="truncate rounded-md bg-secondary px-2 py-[3px] text-[11px] font-medium text-muted-foreground">
            {activeWorkspace.name}
          </span>
        )}
      </div>

      <div className="flex flex-none items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Account menu"
              className="flex size-9 items-center justify-center rounded-full bg-track text-xs font-semibold"
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Floating five-slot tab bar. Replaces the sidebar below lg. */
export function DashboardTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-2.5 z-50 mt-auto grid grid-cols-5 gap-0.5 rounded-[18px] border border-border bg-card/95 p-1.5 shadow-[0_14px_34px_rgba(0,0,0,.2)] backdrop-blur-xl lg:hidden dark:shadow-[0_14px_34px_rgba(0,0,0,.55)]"
    >
      {mobileTabItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-[50px] flex-col items-center justify-center gap-1 rounded-[13px] text-[10.5px] font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-[19px]" />
            {item.shortLabel ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
