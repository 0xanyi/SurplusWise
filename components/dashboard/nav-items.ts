import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Repeat,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Shorter label for the mobile tab bar, where five items share the width. */
  shortLabel?: string;
}

export interface NavGroup {
  /** Group heading. Null renders the items with no heading above them. */
  heading: string | null;
  items: NavItem[];
}

/**
 * The eight destinations, grouped. The flat eight-item bar this replaced gave
 * every destination equal weight; splitting them into "what moved" and "what
 * you hold" means the sidebar can be read as two short lists instead of one
 * long one.
 */
export const navGroups: NavGroup[] = [
  {
    heading: null,
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
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
      },
      { href: "/dashboard/outgoings", icon: Repeat, label: "Outgoings" },
      { href: "/dashboard/reports", icon: BarChart3, label: "Reports" },
    ],
  },
  {
    heading: "Balance sheet",
    items: [
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
};

/** The five that earn a slot in the mobile tab bar. */
export const mobileTabHrefs = [
  "/dashboard",
  "/dashboard/transactions",
  "/dashboard/outgoings",
  "/dashboard/reports",
  "/dashboard/settings",
];

export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  settingsItem,
];

export const mobileTabItems: NavItem[] = mobileTabHrefs.map(
  (href) => allNavItems.find((item) => item.href === href)!
);
