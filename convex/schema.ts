import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  transactions: defineTable({
    userId: v.string(),
    amount: v.number(),
    date: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving")),
    category: v.string(),
    notes: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId_type", ["userId", "type"])
    .index("by_userId_category", ["userId", "category"]),

  categories: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving")),
    color: v.string(),
    icon: v.optional(v.string()),
    isDefault: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "type"])
    .index("by_userId_name_type", ["userId", "name", "type"]),

  budgets: defineTable({
    userId: v.string(),
    category: v.string(),
    amount: v.number(),
    period: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly")
    ),
    startDate: v.string(),
    endDate: v.string(),
    type: v.union(v.literal("expense"), v.literal("giving")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_active", ["userId", "isActive"])
    .index("by_userId_category", ["userId", "category"]),
});
