import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_EXPENSE_CATEGORIES = [
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

const DEFAULT_GIVING_CATEGORIES = [
  { name: "Tithe", color: "#8b5cf6", icon: "church" },
  { name: "Offering", color: "#3b82f6", icon: "gift" },
  { name: "Partnership", color: "#22c55e", icon: "handshake" },
  { name: "Missions", color: "#f97316", icon: "globe" },
  { name: "Building Fund", color: "#ef4444", icon: "building" },
  { name: "Youth Ministry", color: "#eab308", icon: "users" },
  { name: "Charity", color: "#ec4899", icon: "heart" },
  { name: "Other Giving", color: "#6b7280", icon: "more-horizontal" },
];

export const list = query({
  args: {
    userId: v.string(),
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"))),
  },
  handler: async (ctx, args) => {
    let categories;

    if (args.type) {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_userId_type", (q) =>
          q.eq("userId", args.userId).eq("type", args.type!)
        )
        .collect();
    } else {
      categories = await ctx.db
        .query("categories")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
    }

    categories.sort((a, b) => a.name.localeCompare(b.name));

    return categories;
  },
});

export const ensureDefaults = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      return { created: false, message: "Categories already exist" };
    }

    const now = Date.now();

    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      await ctx.db.insert("categories", {
        userId: args.userId,
        name: cat.name,
        type: "expense",
        color: cat.color,
        icon: cat.icon,
        isDefault: true,
        createdAt: now,
      });
    }

    for (const cat of DEFAULT_GIVING_CATEGORIES) {
      await ctx.db.insert("categories", {
        userId: args.userId,
        name: cat.name,
        type: "giving",
        color: cat.color,
        icon: cat.icon,
        isDefault: true,
        createdAt: now,
      });
    }

    return { created: true, message: "Default categories created" };
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving")),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_userId_name_type", (q) =>
        q.eq("userId", args.userId).eq("name", args.name).eq("type", args.type)
      )
      .first();

    if (existing) {
      throw new Error("Category with this name already exists");
    }

    return await ctx.db.insert("categories", {
      userId: args.userId,
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
    userId: v.string(),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== args.userId) {
      throw new Error("Category not found or unauthorized");
    }

    if (category.isDefault) {
      throw new Error("Cannot modify default categories");
    }

    const { id, userId, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: {
    id: v.id("categories"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category || category.userId !== args.userId) {
      throw new Error("Category not found or unauthorized");
    }

    if (category.isDefault) {
      throw new Error("Cannot delete default categories");
    }

    await ctx.db.delete(args.id);
  },
});
