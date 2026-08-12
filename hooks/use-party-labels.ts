"use client";

import { useWorkspace } from "@/contexts/workspace-context";
import { getPartyLabels, type PartyLabels } from "@/lib/party-labels";

/**
 * "Clients" in a business workspace, "People" in a personal one.
 *
 * Falls back to the business vocabulary before the workspace resolves, so a
 * heading never flickers from one word to the other on first paint.
 */
export function usePartyLabels(): PartyLabels {
  const { activeWorkspace } = useWorkspace();
  return getPartyLabels(activeWorkspace?.type);
}
