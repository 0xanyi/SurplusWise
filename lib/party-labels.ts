/**
 * One table, two vocabularies.
 *
 * A business workspace fronts costs for *clients*; a personal one covers costs
 * for *people* — the family phone plan a sibling pays back, a streaming account
 * split three ways. The shape is identical, so the data model does not fork;
 * only the words do.
 *
 * This is the second place in the app that branches on workspace type, after
 * `components/dashboard/workspace-switcher.tsx`. Keep it the last one: every
 * further branch makes the two workspace types drift into two products.
 */

export type WorkspaceType = "personal" | "business";

export interface PartyLabels {
  /** "Clients" — nav item, page title, list heading. */
  plural: string;
  /** "Client" — form label, singular reference. */
  singular: string;
  /** "client" — mid-sentence in body copy. */
  lowerSingular: string;
  /** "clients" — mid-sentence in body copy. */
  lowerPlural: string;
  /** The field label on a cost that names who it is carried for. */
  billedTo: string;
  /** Empty-state sentence for the list page. */
  emptyBody: string;
  /** What a cost with no party attached is called. */
  ownCosts: string;
}

const BUSINESS: PartyLabels = {
  plural: "Clients",
  singular: "Client",
  lowerSingular: "client",
  lowerPlural: "clients",
  billedTo: "Billed to",
  emptyBody:
    "Add a client to track the services you pay for on their behalf, and what comes back.",
  ownCosts: "Own overhead",
};

const PERSONAL: PartyLabels = {
  plural: "People",
  singular: "Person",
  lowerSingular: "person",
  lowerPlural: "people",
  billedTo: "Covered for",
  emptyBody:
    "Add a person to track costs you cover for them, and what they pay back.",
  ownCosts: "Your own costs",
};

export function getPartyLabels(workspaceType: WorkspaceType | undefined): PartyLabels {
  return workspaceType === "personal" ? PERSONAL : BUSINESS;
}
