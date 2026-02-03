"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const AnalyticsCharts = dynamic(
  () =>
    import("@/components/dashboard/analytics-charts").then(
      (mod) => mod.AnalyticsCharts
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    ),
  }
);

export function AnalyticsChartsClient() {
  return <AnalyticsCharts />;
}
