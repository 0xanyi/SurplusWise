import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "./auth";

export const list = query({
  args: {
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    let budgets;

    if (args.isActive !== undefined) {
      budgets = await ctx.db
        .query("budgets")
        .withIndex("by_userId_active", (q) =>
          q.eq("userId", userId).eq("isActive", args.isActive!)
        )
        .collect();
    } else {
      budgets = await ctx.db
        .query("budgets")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    }

    return budgets;
  },
});

export const create = mutation({
  args: {
    category: v.string(),
    amount: v.number(),
    period: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly")
    ),
    startDate: v.string(),
    endDate: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving"), v.literal("income")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("budgets", {
      userId,
      category: args.category,
      amount: args.amount,
      period: args.period,
      startDate: args.startDate,
      endDate: args.endDate,
      type: args.type,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("budgets"),
    category: v.optional(v.string()),
    amount: v.optional(v.number()),
    period: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly")
      )
    ),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"), v.literal("income"))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const budget = await ctx.db.get(args.id);
    if (!budget || budget.userId !== userId) {
      throw new Error("Budget not found or unauthorized");
    }

    const { id, ...updates } = args;
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const budget = await ctx.db.get(args.id);
    if (!budget || budget.userId !== userId) {
      throw new Error("Budget not found or unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

export const getWithSpending = query({
  args: {
    period: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    let budgets = await ctx.db
      .query("budgets")
      .withIndex("by_userId_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();

    if (args.period) {
      budgets = budgets.filter((b) => b.period === args.period);
    }

    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const transactions = await ctx.db
          .query("transactions")
          .withIndex("by_userId_date", (q) =>
            q
              .eq("userId", userId)
              .gte("date", budget.startDate)
              .lte("date", budget.endDate)
          )
          .collect();

        const spent = transactions
          .filter(
            (t) => t.category === budget.category && t.type === budget.type
          )
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          ...budget,
          spent,
          remaining: budget.amount - spent,
          percentUsed: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
        };
      })
    );

    return budgetsWithSpending;
  },
});
