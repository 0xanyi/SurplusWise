"use client"

 import { useState } from "react"
 import Link from "next/link"
 import { useRouter, usePathname } from "next/navigation"
 import {
   LayoutDashboard,
   Receipt,
   BarChart3,
   Settings,
   LogOut,
   Wallet,
   Menu,
   X,
   ChevronDown,
   Bell
 } from "lucide-react"
 import { Button } from "@/components/ui/button"
 import { ThemeToggle } from "@/components/ui/theme-toggle"
 import { authClient } from "@/lib/auth-client"
 import { useToast } from "@/hooks/use-toast"
 import { cn } from "@/lib/utils"
 import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu"
  import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

 interface User {
   id: string
   email: string
   name: string
   image?: string
 }

 interface DashboardNavProps {
   user: User
 }

 export default function DashboardNav({ user }: DashboardNavProps) {
   const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
   const router = useRouter()
   const pathname = usePathname()
   const { toast } = useToast()

   const handleLogout = async () => {
     await authClient.signOut()
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
     { href: "/dashboard/reports", icon: BarChart3, label: "Reports" },
     { href: "/dashboard/settings", icon: Settings, label: "Settings" },
   ]

   return (
     <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 supports-[backdrop-filter]:bg-background/60">
       <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
         <div className="flex items-center justify-between h-16">
           {/* Logo */}
           <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="size-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-all duration-300 group-hover:scale-105">
                <Wallet className="size-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg tracking-tight hidden sm:block">
                SurplusWise
                </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                    <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                        isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                    </Link>
                )
                })}
            </div>
           </div>

           {/* Right Section */}
           <div className="flex items-center gap-2 sm:gap-4">
             <div className="hidden sm:flex items-center gap-2">
                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
                    <Bell className="size-5" />
                </Button>
                <ThemeToggle />
             </div>

             <div className="h-6 w-px bg-border/50 hidden sm:block"></div>

             {/* User Dropdown */}
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full sm:h-auto sm:w-auto sm:px-2 sm:py-1.5 sm:rounded-xl hover:bg-muted/50 gap-2">
                        <Avatar className="h-8 w-8 border border-border/50">
                            <AvatarImage src={user.image} alt={user.name} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {(user.name || user.email)?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:flex flex-col items-start text-left">
                            <span className="text-sm font-medium leading-none">{user.name || 'User'}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 max-w-[100px] truncate">{user.email}</span>
                        </div>
                        <ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground ml-1" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                        </p>
                    </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/settings" className="cursor-pointer">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/reports" className="cursor-pointer">Reports</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                        Log out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

             {/* Mobile Menu Toggle */}
             <Button
               variant="ghost"
               size="icon"
               className="md:hidden"
               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
             >
               {mobileMenuOpen ? (
                 <X className="size-5" />
               ) : (
                 <Menu className="size-5" />
               )}
             </Button>
           </div>
         </div>

         {/* Mobile Menu */}
         {mobileMenuOpen && (
           <div className="md:hidden py-4 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
             <div className="flex flex-col gap-1 p-2">
               {navItems.map((item) => {
                 const Icon = item.icon
                 const isActive = pathname === item.href
                 return (
                   <Link
                     key={item.href}
                     href={item.href}
                     onClick={() => setMobileMenuOpen(false)}
                     className={cn(
                       "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                       isActive
                         ? "bg-primary/10 text-primary"
                         : "text-muted-foreground hover:bg-muted hover:text-foreground"
                     )}
                   >
                     <Icon className="size-5" />
                     <span>{item.label}</span>
                   </Link>
                 )
               })}
             </div>
             
             <div className="mt-4 pt-4 border-t border-border/50 px-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Theme</span>
                <ThemeToggle />
             </div>

             <div className="mt-2 px-2">
                <Button 
                    variant="ghost" 
                    className="w-full justify-start text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                </Button>
             </div>
           </div>
         )}
       </div>
     </nav>
   )
 }
