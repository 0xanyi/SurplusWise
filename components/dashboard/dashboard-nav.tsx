"use client"
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
   ChevronDown
 } from "lucide-react"
 import { Button } from "@/components/ui/button"
 import { ThemeToggle } from "@/components/ui/theme-toggle"
 import { authClient } from "@/lib/auth-client"
 import { useToast } from "@/hooks/use-toast"
 import { cn } from "@/lib/utils"

 interface User {
   id: string
   email: string
   name: string
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
     <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
       <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
         <div className="flex items-center justify-between h-16">
           {/* Logo */}
           <Link href="/dashboard" className="flex items-center gap-3 group">
             <div className="size-9 rounded-xl bg-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
               <Wallet className="size-5 text-primary-foreground" />
             </div>
             <span className="font-semibold text-lg tracking-tight hidden sm:block">
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
                     "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                     isActive
                       ? "bg-primary text-primary-foreground shadow-sm"
                       : "text-muted-foreground hover:text-foreground hover:bg-muted"
                   )}
                 >
                   <Icon className="size-4" />
                   <span>{item.label}</span>
                 </Link>
               )
             })}
           </div>

           {/* Right Section */}
           <div className="flex items-center gap-2">
             {/* User Info - Desktop */}
             <div className="hidden sm:flex items-center gap-3 pr-2 border-r border-border/50 mr-2">
               <div className="size-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                 <span className="text-sm font-semibold text-primary">
                   {(user.name || user.email)?.charAt(0).toUpperCase()}
                 </span>
               </div>
               <span className="text-sm text-muted-foreground hidden lg:block max-w-[120px] truncate">
                 {user.name || user.email}
               </span>
             </div>

             <ThemeToggle />

             <Button
               variant="ghost"
               size="icon"
               onClick={handleLogout}
               className="text-muted-foreground hover:text-foreground hover:bg-muted"
             >
               <LogOut className="size-4" />
             </Button>

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
             <div className="flex flex-col gap-1">
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
                         ? "bg-primary text-primary-foreground"
                         : "text-muted-foreground hover:bg-muted hover:text-foreground"
                     )}
                   >
                     <Icon className="size-5" />
                     <span>{item.label}</span>
                   </Link>
                 )
               })}
             </div>

             {/* Mobile User Info */}
             <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-3 px-4">
               <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                 <span className="text-sm font-semibold text-primary">
                   {(user.name || user.email)?.charAt(0).toUpperCase()}
                 </span>
               </div>
               <div className="flex-1 min-w-0">
                 <p className="text-sm font-medium truncate">{user.name || 'User'}</p>
                 <p className="text-xs text-muted-foreground truncate">{user.email}</p>
               </div>
             </div>
           </div>
         )}
       </div>
     </nav>
   )
 }