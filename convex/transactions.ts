import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "./auth";

export const list = query({
  args: {
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"), v.literal("income"))),
    category: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    let transactions;

    // Use by_userId_date index for date range filtering at the database level
    if (args.startDate && args.endDate) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId_date", (q) =>
          q.eq("userId", userId).gte("date", args.startDate!).lte("date", args.endDate!)
        )
        .collect();
    } else if (args.startDate) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId_date", (q) =>
          q.eq("userId", userId).gte("date", args.startDate!)
        )
        .collect();
    } else if (args.endDate) {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId_date", (q) =>
          q.eq("userId", userId).lte("date", args.endDate!)
        )
        .collect();
    } else {
      transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    }

    // Filter by type in memory (can't combine with date index)
    if (args.type) {
      transactions = transactions.filter((t) => t.type === args.type);
    }

    if (args.category) {
      transactions = transactions.filter((t) => t.category === args.category);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      transactions = transactions.filter(
        (t) =>
          t.category.toLowerCase().includes(searchLower) ||
          (t.notes && t.notes.toLowerCase().includes(searchLower))
      );
    }

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return transactions;
  },
});

export const listPaginated = query({
  args: {
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"), v.literal("income"))),
    category: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    let queryBuilder = ctx.db
      .query("transactions")
      .withIndex("by_userId_date", (q) => {
        if (args.startDate && args.endDate) {
          return q.eq("userId", userId).gte("date", args.startDate).lte("date", args.endDate);
        } else if (args.startDate) {
          return q.eq("userId", userId).gte("date", args.startDate);
        } else if (args.endDate) {
          return q.eq("userId", userId).lte("date", args.endDate);
        }
        return q.eq("userId", userId);
      });

    if (args.type) {
      queryBuilder = queryBuilder.filter((q) => q.eq(q.field("type"), args.type));
    }

    if (args.category) {
      queryBuilder = queryBuilder.filter((q) => q.eq(q.field("category"), args.category));
    }

    const result = await queryBuilder.order("desc").paginate(args.paginationOpts);

    if (!args.search) {
      return result;
    }

    const searchLower = args.search.toLowerCase();
    return {
      ...result,
      page: result.page.filter(
        (t) =>
          t.category.toLowerCase().includes(searchLower) ||
          (t.notes && t.notes.toLowerCase().includes(searchLower))
      ),
    };
  },
});

export const create = mutation({
  args: {
    amount: v.number(),
    date: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving"), v.literal("income")),
    category: v.string(),
    notes: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("transactions", {
      userId,
      amount: args.amount,
      date: args.date,
      type: args.type,
      category: args.category,
      notes: args.notes,
      receiptStorageId: args.receiptStorageId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("transactions"),
    amount: v.optional(v.number()),
    date: v.optional(v.string()),
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"), v.literal("income"))),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const transaction = await ctx.db.get(args.id);
    if (!transaction || transaction.userId !== userId) {
      throw new Error("Transaction not found or unauthorized");
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
    id: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const transaction = await ctx.db.get(args.id);
    if (!transaction || transaction.userId !== userId) {
      throw new Error("Transaction not found or unauthorized");
    }

    if (transaction.receiptStorageId) {
      await ctx.storage.delete(transaction.receiptStorageId);
    }

    await ctx.db.delete(args.id);
  },
});

export const getById = query({
  args: {
    id: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const transaction = await ctx.db.get(args.id);
    if (!transaction || transaction.userId !== userId) {
      return null;
    }
    return transaction;
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const limit = args.limit ?? 5;
    return await ctx.db
      .query("transactions")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});
