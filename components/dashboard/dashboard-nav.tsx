"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Receipt,
  ChartBar,
  Settings,
  LogOut,
  Plus,
  Wallet
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@supabase/supabase-js"

interface DashboardNavProps {
  user: User
}

export default function DashboardNav({ user }: DashboardNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    })
    router.push("/auth/login")
    router.refresh()
  }

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/transactions", icon: Receipt, label: "Transactions" },
    { href: "/dashboard/reports", icon: ChartBar, label: "Reports" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  ]

  return (
    <nav className="bg-background border-b sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Wallet className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">SurplusWise</span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">{user.email}</span>
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3 flex space-x-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
