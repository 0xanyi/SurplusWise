import { AnalyticsChartsClient } from "./analytics-charts-client";
import { PageHeader } from "@/components/dashboard/page-header";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Money in & out"
        title="Reports"
      />

      <AnalyticsChartsClient />
    </div>
  );
}
