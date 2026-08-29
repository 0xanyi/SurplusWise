"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseDashboardPeriod,
  type DashboardPeriod,
} from "@/lib/dashboard-period";

export function useDashboardPeriod() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = parseDashboardPeriod(searchParams.get("period"));

  const setPeriod = useCallback(
    (next: DashboardPeriod) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "month") params.delete("period");
      else params.set("period", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [period, setPeriod] as const;
}
