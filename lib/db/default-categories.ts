/**
 * Default category definitions seeded per-user on first sign-in.
 * Kept in sync with the Convex `categories.ts` defaults.
 */

export type TransactionType = "expense" | "giving" | "income";

export interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: "Food & Dining", color: "#ef4444", icon: "utensils" },
  { name: "Transportation", color: "#f97316", icon: "car" },
  { name: "Shopping", color: "#eab308", icon: "shopping-bag" },
  { name: "Entertainment", color: "#22c55e", icon: "film" },
  { name: "Bills & Utilities", color: "#3b82f6", icon: "file-text" },
  { name: "Healthcare", color: "#8b5cf6", icon: "heart-pulse" },
  { name: "Education", color: "#ec4899", icon: "graduation-cap" },
  { name: "Travel", color: "#14b8a6", icon: "plane" },
  { name: "Personal Care", color: "#f43f5e", icon: "sparkles" },
  { name: "Other", color: "#6b7280", icon: "more-horizontal" },
];

export const DEFAULT_GIVING_CATEGORIES: DefaultCategory[] = [
  { name: "Tithe", color: "#8b5cf6", icon: "church" },
  { name: "Offering", color: "#3b82f6", icon: "gift" },
  { name: "Missions", color: "#f97316", icon: "globe" },
  { name: "Benevolence", color: "#ec4899", icon: "heart-handshake" },
  { name: "First Fruits", color: "#22c55e", icon: "leaf" },
  { name: "Building Project", color: "#ef4444", icon: "building" },
  { name: "Pastoral Support", color: "#06b6d4", icon: "hand-heart" },
  { name: "Other Giving", color: "#6b7280", icon: "more-horizontal" },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: "Salary", color: "#10b981", icon: "banknote" },
  { name: "Freelance", color: "#06b6d4", icon: "laptop" },
  { name: "Business", color: "#8b5cf6", icon: "briefcase" },
  { name: "Investments", color: "#f59e0b", icon: "trending-up" },
  { name: "Rental Income", color: "#3b82f6", icon: "home" },
  { name: "Gifts Received", color: "#ec4899", icon: "gift" },
  { name: "Refunds", color: "#14b8a6", icon: "rotate-ccw" },
  { name: "Other Income", color: "#6b7280", icon: "more-horizontal" },
];

export const ALL_DEFAULTS: Record<TransactionType, DefaultCategory[]> = {
  expense: DEFAULT_EXPENSE_CATEGORIES,
  giving: DEFAULT_GIVING_CATEGORIES,
  income: DEFAULT_INCOME_CATEGORIES,
};
