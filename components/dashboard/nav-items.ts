import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  HandCoins,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  Repeat,
  Settings,
  WalletCards,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Shorter label for the mobile tab bar, where five items share the width. */
  shortLabel?: string;
  /** Earns a slot in the mobile tab bar. Five is the most a thumb row holds. */
  mobileTab?: boolean;
  /** Carries the count of outgoings that are due or overdue. */
  showsDueBadge?: boolean;
  /**
   * Label comes from the workspace vocabulary rather than `label`: "Clients"
   * in a business workspace, "People" in a personal one. See
   * `lib/party-labels.ts`.
   */
  usesPartyLabel?: boolean;
}

export interface NavGroup {
  /** Group heading. Null renders the items with no heading above them. */
  heading: string | null;
  items: NavItem[];
}

/**
 * The destinations, grouped. The flat bar this replaced gave every destination
 * equal weight; splitting them into "what moved" and "what you hold" means the
 * sidebar can be read as two short lists instead of one long one.
 */
export const navGroups: NavGroup[] = [
  {
    heading: null,
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Overview", mobileTab: true },
    ],
  },
  {
    heading: "Money in & out",
    items: [
      {
        href: "/dashboard/transactions",
        icon: ArrowLeftRight,
        label: "Transactions",
        shortLabel: "Activity",
        mobileTab: true,
      },
      {
        href: "/dashboard/outgoings",
        icon: Repeat,
        label: "Outgoings",
        mobileTab: true,
        showsDueBadge: true,
      },
      { href: "/dashboard/calendar", icon: CalendarDays, label: "Calendar" },
      {
        href: "/dashboard/clients",
        icon: Users,
        // Overridden per workspace type; this is the fallback and the value the
        // mobile tab bar would use if it ever earned a slot.
        label: "Clients",
        usesPartyLabel: true,
      },
      { href: "/dashboard/giving", icon: HeartHandshake, label: "Giving" },
      { href: "/dashboard/reports", icon: BarChart3, label: "Reports", mobileTab: true },
    ],
  },
  {
    heading: "Balance sheet",
    items: [
      { href: "/dashboard/accounts", icon: WalletCards, label: "Accounts" },
      { href: "/dashboard/debts", icon: CreditCard, label: "Debts" },
      { href: "/dashboard/loans", icon: HandCoins, label: "Loans given" },
      { href: "/dashboard/investments", icon: Landmark, label: "Investments" },
    ],
  },
];

export const settingsItem: NavItem = {
  href: "/dashboard/settings",
  icon: Settings,
  label: "Settings",
  mobileTab: true,
};

export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  settingsItem,
];

/** The five that earn a slot in the mobile tab bar, in nav order. */
export const mobileTabItems: NavItem[] = allNavItems.filter((item) => item.mobileTab);
