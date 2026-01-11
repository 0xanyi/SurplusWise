"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Download, Calendar, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { Select } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#6366f1", // indigo
];

type Period = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

interface AnalyticsData {
  totalExpenses: number;
  totalGivings: number;
  transactionCount: number;
  expensesByCategoryArray: { name: string; value: number }[];
  givingsByCategoryArray: { name: string; value: number }[];
  dailyTrends: { date: string; expenses: number; givings: number }[];
  monthlyTrends: { month: string; expenses: number; givings: number }[];
}

export function AnalyticsCharts() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [period, startDate, endDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = `/api/analytics?period=${period}`;
      if (period === "custom" && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!analytics) return;

    const csvData = [
      ["Category", "Type", "Amount"],
      ...analytics.expensesByCategoryArray.map((item) => [
        item.name,
        "Expense",
        item.value.toString(),
      ]),
      ...analytics.givingsByCategoryArray.map((item) => [
        item.name,
        "Giving",
        item.value.toString(),
      ]),
    ];

    const csv = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `surpluswise-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = async () => {
    if (!analytics || !reportRef.current) return;

    setExporting(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add header
      pdf.setFontSize(20);
      pdf.setTextColor(59, 130, 246);
      pdf.text("SurplusWise Financial Report", pageWidth / 2, 15, { align: "center" });

      // Add date and period
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      const dateStr = new Date().toLocaleDateString();
      pdf.text(`Generated: ${dateStr}`, pageWidth / 2, 22, { align: "center" });
      pdf.text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, pageWidth / 2, 27, { align: "center" });

      // Add summary section
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Financial Summary", 14, 40);

      pdf.setFontSize(11);
      const netBalance = analytics.totalGivings - analytics.totalExpenses;
      const summaryY = 48;

      pdf.setTextColor(239, 68, 68);
      pdf.text(`Total Expenses: £${analytics.totalExpenses.toFixed(2)}`, 14, summaryY);

      pdf.setTextColor(16, 185, 129);
      pdf.text(`Total Givings: £${analytics.totalGivings.toFixed(2)}`, 14, summaryY + 7);

      pdf.setTextColor(netBalance >= 0 ? 16 : 239, netBalance >= 0 ? 185 : 68, netBalance >= 0 ? 129 : 68);
      pdf.text(`Net Balance: £${Math.abs(netBalance).toFixed(2)} (${netBalance >= 0 ? 'Surplus' : 'Deficit'})`, 14, summaryY + 14);

      pdf.setTextColor(0, 0, 0);
      pdf.text(`Transactions: ${analytics.transactionCount}`, 14, summaryY + 21);

      // Add expense categories
      if (analytics.expensesByCategoryArray.length > 0) {
        pdf.setFontSize(14);
        pdf.text("Expense Categories", 14, summaryY + 35);

        pdf.setFontSize(10);
        let yPos = summaryY + 43;
        analytics.expensesByCategoryArray.forEach((item, index) => {
          const percentage = (item.value / analytics.totalExpenses * 100).toFixed(1);
          pdf.text(`${item.name}: £${item.value.toFixed(2)} (${percentage}%)`, 14, yPos);
          yPos += 6;

          // Add new page if needed
          if (yPos > pageHeight - 30) {
            pdf.addPage();
            yPos = 20;
          }
        });

        yPos += 8;

        // Add giving categories
        if (analytics.givingsByCategoryArray.length > 0) {
          pdf.setFontSize(14);
          pdf.text("Giving Categories", 14, yPos);

          pdf.setFontSize(10);
          yPos += 8;
          analytics.givingsByCategoryArray.forEach((item) => {
            const percentage = (item.value / analytics.totalGivings * 100).toFixed(1);
            pdf.text(`${item.name}: £${item.value.toFixed(2)} (${percentage}%)`, 14, yPos);
            yPos += 6;

            // Add new page if needed
            if (yPos > pageHeight - 30) {
              pdf.addPage();
              yPos = 20;
            }
          });
        }
      }

      // Add footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Page ${i} of ${totalPages} | SurplusWise © ${new Date().getFullYear()}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Save the PDF
      pdf.save(`surpluswise-report-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Failed to load analytics</p>
      </div>
    );
  }

  const netBalance = analytics.totalGivings - analytics.totalExpenses;
  const trendsData = period === "yearly" || period === "quarterly"
    ? analytics.monthlyTrends
    : analytics.dailyTrends;

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Period Selector and Export */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="weekly">Last 7 Days</option>
              <option value="monthly">This Month</option>
              <option value="quarterly">This Quarter</option>
              <option value="yearly">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {period === "custom" && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={exportToPDF} variant="outline" disabled={exporting}>
            <FileText className="h-4 w-4 mr-2" />
            {exporting ? "Generating..." : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(analytics.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Givings
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(analytics.totalGivings)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                netBalance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(Math.abs(netBalance))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {netBalance >= 0 ? "Surplus" : "Deficit"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spending Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Spending Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {trendsData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No data available for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={period === "yearly" || period === "quarterly" ? "month" : "date"}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  labelStyle={{ color: "#000" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="givings"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Givings"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown - Side by Side */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Expense Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.expensesByCategoryArray.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No expense data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.expensesByCategoryArray}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const safePercent = typeof percent === "number" ? percent : 0;
                        return `${name}: ${(safePercent * 100).toFixed(0)}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.expensesByCategoryArray.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {analytics.expensesByCategoryArray.map((item, index) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Giving Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Giving Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.givingsByCategoryArray.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No giving data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.givingsByCategoryArray}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const safePercent = typeof percent === "number" ? percent : 0;
                        return `${name}: ${(safePercent * 100).toFixed(0)}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.givingsByCategoryArray.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {analytics.givingsByCategoryArray.map((item, index) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Combined Category Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Category Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.expensesByCategoryArray.length === 0 &&
          analytics.givingsByCategoryArray.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  ...analytics.expensesByCategoryArray.map((item) => ({
                    category: item.name,
                    Expenses: item.value,
                    Givings: 0,
                  })),
                  ...analytics.givingsByCategoryArray.map((item) => ({
                    category: item.name,
                    Expenses: 0,
                    Givings: item.value,
                  })),
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="Expenses" fill="#ef4444" />
                <Bar dataKey="Givings" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
