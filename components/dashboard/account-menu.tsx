"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The three fields both the sidebar and the mobile header need. */
export interface AccountUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

interface AccountMenuProps {
  user: AccountUser;
  /** The trigger — a row in the sidebar footer, an avatar on mobile. */
  children: React.ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
}

/**
 * Shared so the sidebar and the mobile header cannot drift apart: they render
 * different triggers but the same menu, and log out through the same path.
 */
export function AccountMenu({
  user,
  children,
  align = "start",
  side = "bottom",
}: AccountMenuProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    await authClient.signOut();
    toast({ title: "Logged out", description: "You have been logged out." });
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-56">
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
  );
}
