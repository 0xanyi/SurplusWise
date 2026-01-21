"use client";
 "use client";

 import { useQuery } from "convex/react";
 import { api } from "@/convex/_generated/api";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { ArrowDownRight, ArrowUpRight, Wallet, Receipt, Loader2 } from "lucide-react";
 import { formatCurrency, cn } from "@/lib/utils";
 import { DashboardClient } from "@/components/dashboard/dashboard-client";
 import { BudgetOverview } from "@/components/dashboard/budget-overview";
 import { authClient } from "@/lib/auth-client";

 export default function DashboardPage() {
   const { data: session } = authClient.useSession();
   const userId = session?.user?.id;

   const now = new Date();
   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
   const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

   const transactions = useQuery(
     api.transactions.list,
     userId
       ? {
           userId,
           startDate: startOfMonth.toISOString().split("T")[0],
           endDate: endOfMonth.toISOString().split("T")[0],
         }
       : "skip"
   );

   const recentTransactions = useQuery(
     api.transactions.listRecent,
     userId ? { userId, limit: 5 } : "skip"
   );

   if (!userId || transactions === undefined) {
     return (
       <div className="flex items-center justify-center min-h-[400px]">
         <Loader2 className="size-8 animate-spin text-muted-foreground" />
       </div>
     );
   }

   const stats = {
     totalExpenses:
       transactions
         ?.filter((t) => t.type === "expense")
         .reduce((sum, t) => sum + t.amount, 0) || 0,
     totalGivings:
       transactions
         ?.filter((t) => t.type === "giving")
         .reduce((sum, t) => sum + t.amount, 0) || 0,
     transactionCount: transactions?.length || 0,
   };

   const netBalance = stats.totalGivings - stats.totalExpenses;
   const recent = recentTransactions || [];

   const statCards = [
     {
       title: "Total Expenses",
       value: formatCurrency(stats.totalExpenses),
       subtitle: "This month",
       icon: ArrowDownRight,
       color: "text-rose-600 dark:text-rose-400",
       bg: "bg-rose-50 dark:bg-rose-950/30",
       iconBg: "bg-rose-100 dark:bg-rose-900/40",
     },
     {
       title: "Total Givings",
       value: formatCurrency(stats.totalGivings),
       subtitle: "This month",
       icon: ArrowUpRight,
       color: "text-emerald-600 dark:text-emerald-400",
       bg: "bg-emerald-50 dark:bg-emerald-950/30",
       iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
     },
     {
       title: "Net Balance",
       value: formatCurrency(Math.abs(netBalance)),
       subtitle: netBalance >= 0 ? "Surplus" : "Deficit",
       icon: Wallet,
       color: netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
       bg: "bg-blue-50 dark:bg-blue-950/30",
       iconBg: "bg-blue-100 dark:bg-blue-900/40",
     },
     {
       title: "Transactions",
       value: stats.transactionCount.toString(),
       subtitle: "This month",
       icon: Receipt,
       color: "text-foreground",
       bg: "bg-violet-50 dark:bg-violet-950/30",
       iconBg: "bg-violet-100 dark:bg-violet-900/40",
     },
   ];

   return (
     <div className="space-y-8">
       {/* Page Header */}
       <div>
         <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dashboard</h1>
         <p className="text-muted-foreground mt-1">
           Welcome back! Here&apos;s your financial overview.
         </p>
       </div>

       {/* Summary Cards */}
       <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
         {statCards.map((card) => {
           const Icon = card.icon;
           return (
             <Card
               key={card.title}
               className={cn(
                 "relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-200",
                 card.bg
               )}
             >
               <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-sm font-medium text-muted-foreground">
                   {card.title}
                 </CardTitle>
                 <div className={cn("p-2 rounded-lg", card.iconBg)}>
                   <Icon className={cn("size-4", card.color)} />
                 </div>
               </CardHeader>
               <CardContent>
                 <div className={cn("text-2xl font-semibold tracking-tight", card.color)}>
                   {card.value}
                 </div>
                 <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
               </CardContent>
             </Card>
           );
         })}
       </div>

       {/* Budget Overview */}
       <BudgetOverview />

       {/* Recent Transactions */}
       <Card className="border shadow-sm">
         <CardHeader className="pb-4">
           <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
         </CardHeader>
         <CardContent>
           {recent.length === 0 ? (
             <div className="text-center py-12">
               <div className="size-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                 <Receipt className="size-6 text-muted-foreground" />
               </div>
               <p className="font-medium text-foreground">No transactions yet</p>
               <p className="text-sm text-muted-foreground mt-1">
                 Start by adding your first expense or giving
               </p>
             </div>
           ) : (
             <div className="space-y-2">
               {recent.map((transaction) => (
                 <div
                   key={transaction._id}
                   className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors duration-150"
                 >
                   <div className="flex items-center gap-3">
                     <div
                       className={cn(
                         "size-10 rounded-xl flex items-center justify-center",
                         transaction.type === "expense"
                           ? "bg-rose-100 dark:bg-rose-900/40"
                           : "bg-emerald-100 dark:bg-emerald-900/40"
                       )}
                     >
                       {transaction.type === "expense" ? (
                         <ArrowDownRight className="size-5 text-rose-600 dark:text-rose-400" />
                       ) : (
                         <ArrowUpRight className="size-5 text-emerald-600 dark:text-emerald-400" />
                       )}
                     </div>
                     <div>
                       <p className="font-medium text-sm">{transaction.category}</p>
                       <p className="text-xs text-muted-foreground">
                         {new Date(transaction.date).toLocaleDateString('en-US', {
                           month: 'short',
                           day: 'numeric'
                         })}
                       </p>
                     </div>
                   </div>
                   <p
                     className={cn(
                       "font-semibold",
                       transaction.type === "expense"
                         ? "text-rose-600 dark:text-rose-400"
                         : "text-emerald-600 dark:text-emerald-400"
                     )}
                   >
                     {transaction.type === "expense" ? "-" : "+"}
                     {formatCurrency(transaction.amount)}
                   </p>
                 </div>
               ))}
             </div>
           )}
         </CardContent>
       </Card>

       {/* Quick Actions */}
       <DashboardClient />
     </div>
   );
 }