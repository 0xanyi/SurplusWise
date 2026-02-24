"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowDownRight, ArrowUpRight, Loader2, Receipt, TrendingUp, Wallet } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { BudgetOverview } from "@/components/dashboard/budget-overview";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, []);

  const transactions = useQuery(
    api.transactions.list,
    userId
      ? {
          startDate,
          endDate,
        }
      : "skip"
  );

  const recentTransactions = useQuery(api.transactions.listRecent, userId ? { limit: 6 } : "skip");

  if (!userId || transactions === undefined) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const totalGivings = transactions.filter((t) => t.type === "giving").reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpenses - totalGivings;

  const summary = [
    {
      title: "Income",
      value: totalIncome,
      color: "text-blue-600",
      icon: TrendingUp,
    },
    {
      title: "Expenses",
      value: totalExpenses,
      color: "text-rose-600",
      icon: ArrowDownRight,
    },
    {
      title: "Giving",
      value: totalGivings,
      color: "text-emerald-600",
      icon: ArrowUpRight,
    },
    {
      title: "Net balance",
      value: Math.abs(netBalance),
      subtitle: netBalance >= 0 ? "Surplus" : "Deficit",
      color: netBalance >= 0 ? "text-emerald-600" : "text-rose-600",
      icon: Wallet,
    },
  ];

  const recent = recentTransactions || [];

  return (
    <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
          {getGreeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Here&apos;s your {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} snapshot.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">{card.title}</CardTitle>
                <Icon className={cn("size-4", card.color)} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-semibold", card.color)}>{formatCurrency(card.value)}</div>
                {card.subtitle && <p className="text-xs text-muted-foreground">{card.subtitle}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DashboardClient />

      <BudgetOverview />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base sm:text-lg">Recent transactions</CardTitle>
          <Link href="/dashboard/transactions">
            <Button variant="ghost" size="sm" className="h-9">
              View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-10 text-center">
              <Receipt className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-medium">No transactions yet</p>
              <p className="text-sm text-muted-foreground">Use Quick add to create your first entry.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between rounded-lg border p-3.5 sm:p-3">
                  <div>
                    <p className="text-sm font-medium sm:text-base">{tx.category}</p>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      {tx.type} • {new Date(tx.date).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "font-semibold",
                      tx.type === "income"
                        ? "text-blue-600"
                        : tx.type === "giving"
                        ? "text-emerald-600"
                        : "text-rose-600"
                    )}
                  >
                    {tx.type === "expense" ? "-" : "+"}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
