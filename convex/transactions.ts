import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {
    userId: v.string(),
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"))),
    category: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("transactions");

    // Use by_userId_date index for date range filtering at the database level
    if (args.startDate || args.endDate) {
      query = query.withIndex("by_userId_date", (q) => {
        let indexed = q.eq("userId", args.userId);
        if (args.startDate) {
          indexed = indexed.gte("date", args.startDate);
        }
        if (args.endDate) {
          indexed = indexed.lte("date", args.endDate);
        }
        return indexed;
      });
    } else {
      query = query.withIndex("by_userId", (q) => q.eq("userId", args.userId));
    }

    let transactions = await query.collect();

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

export const create = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    date: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving")),
    category: v.string(),
    notes: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("transactions", {
      userId: args.userId,
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
    userId: v.string(),
    amount: v.optional(v.number()),
    date: v.optional(v.string()),
    type: v.optional(v.union(v.literal("expense"), v.literal("giving"))),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.id);
    if (!transaction || transaction.userId !== args.userId) {
      throw new Error("Transaction not found or unauthorized");
    }

    const { id, userId, ...updates } = args;
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("transactions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.id);
    if (!transaction || transaction.userId !== args.userId) {
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
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const transaction = await ctx.db.get(args.id);
    if (!transaction || transaction.userId !== args.userId) {
      return null;
    }
    return transaction;
  },
});

export const listRecent = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    return await ctx.db
      .query("transactions")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});
