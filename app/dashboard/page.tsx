"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Receipt, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here&apos;s your financial overview.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Givings</CardTitle>
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalGivings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <DollarSign className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                netBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(Math.abs(netBalance))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {netBalance >= 0 ? "Surplus" : "Deficit"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Receipt className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.transactionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Overview */}
      <BudgetOverview />

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm mt-2">
                Start by adding your first expense or giving
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((transaction) => (
                <div
                  key={transaction._id}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        transaction.type === "expense"
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      }`}
                    >
                      {transaction.type === "expense" ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-bold ${
                      transaction.type === "expense"
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
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

      {/* Quick Actions and Transaction List (Client Component) */}
      <DashboardClient />
    </div>
  );
}
