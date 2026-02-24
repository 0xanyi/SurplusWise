/**
 * Zod schemas for runtime validation of service-layer inputs.
 *
 * Each schema mirrors the TypeScript interface in the corresponding module
 * but adds runtime constraints (min lengths, positive amounts, date formats, etc.).
 */
import { z } from "zod";

// ─── Shared primitives ───────────────────────────────────────────────────────

/** Non-empty user ID (UUID or provider-issued). */
export const userIdSchema = z.string().min(1, "userId is required");

/**
 * Non-empty resource ID.
 * DB primary keys are `text`, so we accept any non-empty string
 * (UUIDs, cuid, nanoid, etc.).
 */
export const idSchema = z.string().min(1, "id is required");

/**
 * YYYY-MM-DD date string validated as a real calendar date.
 * Rejects structurally-valid but impossible dates like 2025-02-30.
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD format")
  .refine(
    (val) => {
      const [y, m, d] = val.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      );
    },
    { message: "date is not a valid calendar date" },
  );

/** Positive monetary amount. */
export const amountSchema = z.number().positive("amount must be positive");

export const transactionTypeSchema = z.enum(["expense", "giving", "income"]);

// ─── Pagination primitives ────────────────────────────────────────────────────

/** `limit` for listRecent – positive integer, capped at 100. */
export const limitSchema = z
  .number()
  .int("limit must be an integer")
  .min(1, "limit must be at least 1")
  .max(100, "limit must be at most 100");

/** Zero-based page index. */
export const pageSchema = z
  .number()
  .int("page must be an integer")
  .min(0, "page must be non-negative");

/** Rows per page – positive integer, capped at 100. */
export const pageSizeSchema = z
  .number()
  .int("pageSize must be an integer")
  .min(1, "pageSize must be at least 1")
  .max(100, "pageSize must be at most 100");

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactionCreateSchema = z.object({
  amount: amountSchema,
  date: dateStringSchema,
  type: transactionTypeSchema,
  category: z.string().min(1, "category is required"),
  notes: z.string().nullish(),
  receiptStorageId: z.string().nullish(),
});

export const transactionUpdateSchema = z.object({
  amount: amountSchema.optional(),
  date: dateStringSchema.optional(),
  type: transactionTypeSchema.optional(),
  category: z.string().min(1).optional(),
  notes: z.string().nullish(),
  receiptStorageId: z.string().nullish(),
});

export const transactionListFiltersSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    category: z.string().optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    search: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: "startDate must be on or before endDate" },
  )
  .optional()
  .default({});

// ─── Categories ──────────────────────────────────────────────────────────────

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
  type: transactionTypeSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex color"),
  icon: z.string().nullish(),
});

export const categoryUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    icon: z.string().nullish(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.color !== undefined ||
      data.icon !== undefined,
    { message: "At least one field must be provided for update" },
  );

// ─── Budgets ─────────────────────────────────────────────────────────────────

export const budgetPeriodSchema = z.enum(["monthly", "quarterly", "yearly"]);

export const budgetCreateSchema = z
  .object({
    category: z.string().min(1, "category is required"),
    amount: amountSchema,
    period: budgetPeriodSchema,
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    type: transactionTypeSchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be on or before endDate",
  });

export const budgetUpdateSchema = z
  .object({
    category: z.string().min(1).optional(),
    amount: amountSchema.optional(),
    period: budgetPeriodSchema.optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    type: transactionTypeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: "startDate must be on or before endDate" },
  );

// ─── Analytics ───────────────────────────────────────────────────────────────

export const analyticsPeriodSchema = z.enum([
  "week",
  "weekly",
  "month",
  "monthly",
  "quarter",
  "quarterly",
  "year",
  "yearly",
  "custom",
]);

export const analyticsQuerySchema = z
  .object({
    period: analyticsPeriodSchema,
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.period === "custom") {
        return !!data.startDate && !!data.endDate;
      }
      return true;
    },
    { message: "startDate and endDate are required for custom period" },
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: "startDate must be on or before endDate" },
  );

// ─── Recurring Outgoings ─────────────────────────────────────────────────────

// Product scope: recurring outgoings are currently monthly only.
export const outgoingFrequencySchema = z.enum(["monthly"]);

/** Day of month 1-31. */
export const dayOfMonthSchema = z
  .number()
  .int("dayOfMonth must be an integer")
  .min(1, "dayOfMonth must be 1-31")
  .max(31, "dayOfMonth must be 1-31");

export const recurringOutgoingCreateSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
  amount: amountSchema,
  dayOfMonth: dayOfMonthSchema,
  frequency: outgoingFrequencySchema.optional().default("monthly"),
  category: z.string().max(100).nullish(),
  notes: z.string().nullish(),
});

export const recurringOutgoingUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    amount: amountSchema.optional(),
    dayOfMonth: dayOfMonthSchema.optional(),
    frequency: outgoingFrequencySchema.optional(),
    category: z.string().max(100).nullish(),
    notes: z.string().nullish(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.amount !== undefined ||
      data.dayOfMonth !== undefined ||
      data.frequency !== undefined ||
      data.category !== undefined ||
      data.notes !== undefined ||
      data.isActive !== undefined,
    { message: "At least one field must be provided for update" },
  );

// ─── Debts & Credits ─────────────────────────────────────────────────────────

export const debtTypeSchema = z.enum([
  "credit_card",
  "loan",
  "mortgage",
  "overdraft",
  "other",
]);

export const debtCreditCreateSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
  debtType: debtTypeSchema,
  lender: z.string().max(200).nullish(),
  currentBalance: z.number().min(0, "balance must be non-negative"),
  creditLimit: z.number().min(0).nullish(),
  interestRate: z.number().min(0).max(100).nullish(),
  minimumPayment: z.number().min(0).nullish(),
  paymentDayOfMonth: dayOfMonthSchema.nullish(),
  startDate: dateStringSchema.nullish(),
  endDate: dateStringSchema.nullish(),
  notes: z.string().nullish(),
});

export const debtCreditUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    debtType: debtTypeSchema.optional(),
    lender: z.string().max(200).nullish(),
    currentBalance: z.number().min(0).optional(),
    creditLimit: z.number().min(0).nullish(),
    interestRate: z.number().min(0).max(100).nullish(),
    minimumPayment: z.number().min(0).nullish(),
    paymentDayOfMonth: dayOfMonthSchema.nullish(),
    startDate: dateStringSchema.nullish(),
    endDate: dateStringSchema.nullish(),
    notes: z.string().nullish(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" },
  );

export const balanceLogCreateSchema = z.object({
  balance: z.number().min(0, "balance must be non-negative"),
  paymentMade: z.number().min(0).nullish(),
  notes: z.string().nullish(),
  loggedAt: dateStringSchema,
});
