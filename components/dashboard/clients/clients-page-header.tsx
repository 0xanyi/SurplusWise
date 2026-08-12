"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { usePartyLabels } from "@/hooks/use-party-labels";

/**
 * The page title depends on the active workspace, which only exists on the
 * client, so the header is split out rather than making the whole page a
 * client component.
 */
export function ClientsPageHeader() {
  const labels = usePartyLabels();

  return <PageHeader kicker="Money in & out" title={labels.plural} />;
}
