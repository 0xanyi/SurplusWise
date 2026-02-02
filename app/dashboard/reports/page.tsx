import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";

export default function ReportsPage() {
  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Visual insights and detailed reports of your finances
        </p>
      </div>

      <AnalyticsCharts />
    </div>
  );
}
