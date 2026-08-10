"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { SikaLogo } from "@/components/sika-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { mobileTabItems } from "@/components/dashboard/nav-items";
import { useDueOutgoingsCount } from "@/hooks/use-due-outgoings";
import { useWorkspace } from "@/contexts/workspace-context";
import { AccountMenu, type AccountUser } from "@/components/dashboard/account-menu";
import { cn } from "@/lib/utils";

/** Logo, workspace, theme and account — the chrome the sidebar carries on desktop. */
export function DashboardMobileHeader({ user }: { user: AccountUser }) {
  const { activeWorkspace } = useWorkspace();
  const initial = (user.name || user.email).charAt(0).toUpperCase();

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
        <Link
          href="/dashboard/transactions#transaction-search"
          aria-label="Search transactions"
          className="flex size-[38px] items-center justify-center rounded-[11px] border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <Search className="size-4" />
        </Link>
        <ThemeToggle />
        <AccountMenu user={user} align="end">
          <button
            aria-label="Account menu"
            className="flex size-9 items-center justify-center rounded-full bg-track text-xs font-semibold"
          >
            {initial}
          </button>
        </AccountMenu>
      </div>
    </div>
  );
}

/** Floating five-slot tab bar. Replaces the sidebar below lg. */
export function DashboardTabBar() {
  const pathname = usePathname();
  const dueCount = useDueOutgoingsCount();

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
              "relative flex h-[50px] flex-col items-center justify-center gap-1 rounded-[13px] text-[10.5px] font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-[19px]" />
            {item.shortLabel ?? item.label}
            {item.showsDueBadge && dueCount > 0 && (
              <span className="absolute right-[calc(50%-20px)] top-1.5 flex size-[15px] items-center justify-center rounded-full bg-obligation text-[9.5px] font-bold text-obligation-foreground tabular-nums">
                {dueCount}
                <span className="sr-only"> due or overdue</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
