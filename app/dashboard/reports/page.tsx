import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Visual insights and detailed reports of your finances
        </p>
      </div>

      <AnalyticsCharts />
    </div>
  );
}
