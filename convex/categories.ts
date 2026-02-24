import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "./auth";

type CategoryType = "expense" | "giving" | "income";

type DefaultCategory = {
  name: string;
  color: string;
  icon: string;
};

const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
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

const DEFAULT_GIVING_CATEGORIES: DefaultCategory[] = [
  { name: "Tithe", color: "#8b5cf6", icon: "church" },
  { name: "Offering", color: "#3b82f6", icon: "gift" },
  { name: "Missions", color: "#f97316", icon: "globe" },
  { name: "Benevolence", color: "#ec4899", icon: "heart-handshake" },
  { name: "First Fruits", color: "#22c55e", icon: "leaf" },
  { name: "Building Project", color: "#ef4444", icon: "building" },
  { name: "Pastoral Support", color: "#06b6d4", icon: "hand-heart" },
  { name: "Other Giving", color: "#6b7280", icon: "more-horizontal" },
];

const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: "Salary", color: "#10b981", icon: "banknote" },
  { name: "Freelance", color: "#06b6d4", icon: "laptop" },
  { name: "Business", color: "#8b5cf6", icon: "briefcase" },
  { name: "Investments", color: "#f59e0b", icon: "trending-up" },
  { name: "Rental Income", color: "#3b82f6", icon: "home" },
  { name: "Gifts Received", color: "#ec4899", icon: "gift" },
  { name: "Refunds", color: "#14b8a6", icon: "rotate-ccw" },
  { name: "Other Income", color: "#6b7280", icon: "more-horizontal" },
];

export const list = query({
  args: {
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"), v.literal("income"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    let categories;

    if (args.type) {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_userId_type", (q) => q.eq("userId", userId).eq("type", args.type!))
        .collect();
    } else {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    }

    categories.sort((a, b) => a.name.localeCompare(b.name));

    return categories;
  },
});

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const defaultSets: Record<CategoryType, DefaultCategory[]> = {
      expense: DEFAULT_EXPENSE_CATEGORIES,
      giving: DEFAULT_GIVING_CATEGORIES,
      income: DEFAULT_INCOME_CATEGORIES,
    };

    let inserted = 0;

    for (const [type, defaults] of Object.entries(defaultSets) as [CategoryType, DefaultCategory[]][]) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_userId_type", (q) => q.eq("userId", userId).eq("type", type))
        .collect();

      const existingNames = new Set(existing.map((category) => category.name.toLowerCase()));

      for (const category of defaults) {
        if (existingNames.has(category.name.toLowerCase())) {
          continue;
        }

        await ctx.db.insert("categories", {
          userId,
          name: category.name,
          type,
          color: category.color,
          icon: category.icon,
          isDefault: true,
          createdAt: Date.now(),
        });

        inserted += 1;
      }
    }

    return {
      created: inserted > 0,
      message: inserted > 0 ? `Added ${inserted} default categories` : "Categories already up to date",
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving"), v.literal("income")),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_userId_name_type", (q) =>
        q.eq("userId", userId).eq("name", args.name).eq("type", args.type)
      )
      .first();

    if (existing) {
      throw new Error("Category with this name already exists");
    }

    return await ctx.db.insert("categories", {
      userId,
      name: args.name,
      type: args.type,
      color: args.color,
      icon: args.icon,
      isDefault: false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found or unauthorized");
    }

    if (category.isDefault) {
      throw new Error("Cannot modify default categories");
    }

    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: {
    id: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found or unauthorized");
    }

    if (category.isDefault) {
      throw new Error("Cannot delete default categories");
    }

    await ctx.db.delete(args.id);
  },
});
