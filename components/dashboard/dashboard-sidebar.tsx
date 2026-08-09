"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getDaysUntilDue,
  getDueUrgency,
  getEffectiveDueDate,
} from "@/lib/outgoings-date";
import { SikaLogo } from "@/components/sika-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { navGroups, settingsItem } from "@/components/dashboard/nav-items";
import { AccountMenu, type AccountUser } from "@/components/dashboard/account-menu";
import { useDueOutgoingsCount } from "@/hooks/use-due-outgoings";
import { cn } from "@/lib/utils";

const itemClasses =
  "flex h-[38px] items-center gap-[11px] rounded-[10px] px-2.5 text-[13.5px] font-medium transition-colors";

export function NavLink({
  href,
  label,
  icon: Icon,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        itemClasses,
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      <Icon className="size-4 flex-none" />
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-auto rounded-md bg-obligation-surface px-1.5 py-0.5 text-[11px] font-semibold text-obligation tabular-nums">
          {badge}
          <span className="sr-only"> due or overdue</span>
        </span>
      )}
    </Link>
  );
}

export function DashboardSidebar({ user }: { user: AccountUser }) {
  const dueCount = useDueOutgoingsCount();

  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    // The whole rail scrolls, not just the nav. Scrolling only the nav meant a
    // short viewport silently clipped the last destinations while the logo and
    // account footer held their space — eight items need ~366px and a 577px
    // window left the nav 294px.
    <aside className="sticky top-0 hidden h-screen w-[248px] flex-none flex-col gap-6 overflow-y-auto border-r border-border/70 px-3.5 py-5 lg:flex">
      <Link href="/dashboard" className="px-2">
        <SikaLogo />
      </Link>

      <WorkspaceSwitcher />

      {/* flex-1 still pushes the footer down when there is room; without an
          overflow of its own the nav keeps min-height:auto and cannot shrink
          below its content. */}
      <nav className="flex flex-1 flex-col gap-[22px]">
        {navGroups.map((group, i) => (
          <div key={group.heading ?? i} className="flex flex-col gap-0.5">
            {group.heading && (
              <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                {group.heading}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                badge={item.showsDueBadge ? dueCount : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border/70 pt-3">
        <NavLink
          href={settingsItem.href}
          label={settingsItem.label}
          icon={settingsItem.icon}
        />

        <div className="flex items-center gap-1">
          <AccountMenu user={user} align="start" side="top">
            <button className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-left transition-colors hover:bg-secondary/60">
              <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-track text-[11px] font-semibold text-foreground">
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">
                  {user.name || "User"}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user.email}
                </span>
              </span>
            </button>
          </AccountMenu>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
