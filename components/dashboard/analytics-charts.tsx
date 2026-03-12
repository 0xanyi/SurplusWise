"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Download, Calendar, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Period = "monthly" | "yearly" | "custom";

interface AnalyticsData {
  totalExpenses: number;
  totalGivings: number;
  totalIncome: number;
  safeToSpend: number;
  transactionCount: number;
  expensesByCategoryArray: { name: string; value: number }[];
  givingsByCategoryArray: { name: string; value: number }[];
  incomeByCategoryArray: { name: string; value: number }[];
  dailyTrends: { date: string; expenses: number; givings: number; income: number }[];
  monthlyTrends: { month: string; expenses: number; givings: number; income: number }[];
}

const CHART_COLORS = ["#2563eb", "#059669", "#e11d48", "#f59e0b", "#8b5cf6", "#06b6d4"];

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryList({
  title,
  items,
}: {
  title: string;
  items: { name: string; value: number }[];
}) {
  const topItems = items.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {topItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">{item.name}</span>
                <span className="font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsCharts() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/analytics?period=${period}`;
      if (period === "custom" && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to load analytics");
      }

      const data = (await response.json()) as AnalyticsData;
      setAnalytics(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load analytics";
      toast({ title: "Error", description: message, variant: "destructive" });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, toast]);

  useEffect(() => {
    if (period === "custom" && (!startDate || !endDate)) {
      return;
    }
    fetchAnalytics();
  }, [fetchAnalytics, period, startDate, endDate]);

  const netBalance = useMemo(() => {
    if (!analytics) return 0;
    return analytics.totalIncome - analytics.totalExpenses - analytics.totalGivings;
  }, [analytics]);

  const chartData = useMemo(() => {
    if (!analytics) return [];

    if (period === "yearly") {
      return analytics.monthlyTrends.map((item) => ({
        label: item.month,
        income: item.income,
        expenses: item.expenses,
        givings: item.givings,
      }));
    }

    return analytics.dailyTrends.map((item) => ({
      label: item.date,
      income: item.income,
      expenses: item.expenses,
      givings: item.givings,
    }));
  }, [analytics, period]);

  const exportCsv = () => {
    if (!analytics) return;

    const rows = [
      ["Category", "Type", "Amount"],
      ...analytics.incomeByCategoryArray.map((item) => [item.name, "Income", item.value.toString()]),
      ...analytics.expensesByCategoryArray.map((item) => [item.name, "Expense", item.value.toString()]),
      ...analytics.givingsByCategoryArray.map((item) => [item.name, "Giving", item.value.toString()]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `surpluswise-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!analytics) {
    return <p className="text-sm text-muted-foreground">No report data available.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="monthly">This month</option>
              <option value="yearly">This year</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Income</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-blue-600">
            {formatCurrency(analytics.totalIncome)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-rose-600">
            {formatCurrency(analytics.totalExpenses)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Giving</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-emerald-600">
            {formatCurrency(analytics.totalGivings)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net</CardTitle>
          </CardHeader>
          <CardContent className={`text-xl font-semibold ${netBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {netBalance >= 0 ? <Wallet className="mr-1 inline size-4" /> : <TrendingDown className="mr-1 inline size-4" />}
            {formatCurrency(Math.abs(netBalance))}
            <span className="ml-1 text-xs text-muted-foreground">{netBalance >= 0 ? "surplus" : "deficit"}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Safe to spend</CardTitle>
          </CardHeader>
          <CardContent className={`text-xl font-semibold ${analytics.safeToSpend >= 0 ? "text-blue-600" : "text-rose-600"}`}>
            <PiggyBank className="mr-1 inline size-4" />
            {formatCurrency(Math.abs(analytics.safeToSpend))}
            <span className="ml-1 text-xs text-muted-foreground">{analytics.safeToSpend >= 0 ? "available" : "overcommitted"}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trend data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Legend />
                <Line dataKey="income" stroke="#2563eb" strokeWidth={2} name="Income" dot={false} />
                <Line dataKey="expenses" stroke="#e11d48" strokeWidth={2} name="Expenses" dot={false} />
                <Line dataKey="givings" stroke="#059669" strokeWidth={2} name="Giving" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.expensesByCategoryArray.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense categories for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.expensesByCategoryArray.slice(0, 6)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {analytics.expensesByCategoryArray.slice(0, 6).map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.expensesByCategoryArray.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense categories for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.expensesByCategoryArray.slice(0, 6)} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CategoryList title="Income Categories" items={analytics.incomeByCategoryArray} />
        <CategoryList title="Expense Categories" items={analytics.expensesByCategoryArray} />
        <CategoryList title="Giving Categories" items={analytics.givingsByCategoryArray} />
      </div>

      <p className="text-sm text-muted-foreground">Transactions in report: {analytics.transactionCount}</p>
    </div>
  );
}
