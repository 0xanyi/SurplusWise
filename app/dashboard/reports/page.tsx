import { AnalyticsChartsClient } from "./analytics-charts-client";

export default function ReportsPage() {
  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">
          View trends and export your finance summary when needed.
        </p>
      </div>

      <AnalyticsChartsClient />
    </div>
  );
}
