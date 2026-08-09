"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { SikaLogo } from "@/components/sika-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { navGroups, settingsItem } from "@/components/dashboard/nav-items";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

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
        </span>
      )}
    </Link>
  );
}

export function DashboardSidebar({ user }: { user: SidebarUser }) {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    await authClient.signOut();
    toast({ title: "Logged out", description: "You have been logged out." });
    router.push("/auth/login");
    router.refresh();
  };

  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] flex-none flex-col gap-6 border-r border-border/70 px-3.5 py-5 lg:flex">
      <Link href="/dashboard" className="px-2">
        <SikaLogo />
      </Link>

      <WorkspaceSwitcher />

      <nav className="flex flex-1 flex-col gap-[22px] overflow-y-auto">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
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
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
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
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
