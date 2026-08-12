/**
 * Zod schemas for runtime validation of service-layer inputs.
 *
 * Each schema mirrors the TypeScript interface in the corresponding module
 * but adds runtime constraints (min lengths, positive amounts, date formats, etc.).
 */
import { z } from "zod";
import { INTEREST_BUCKET_TYPES, MAX_INTEREST_BUCKETS } from "@/lib/debt-interest";

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

// ─── Workspaces ─────────────────────────────────────────────────────────────

export const workspaceTypeSchema = z.enum(["personal", "business"]);

export const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO code");

export const workspaceIdSchema = z.string().min(1, "workspaceId is required");

export const workspaceCreateSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
  type: workspaceTypeSchema,
  currency: currencySchema.optional().default("GBP"),
});

export const workspaceUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    type: workspaceTypeSchema.optional(),
    currency: currencySchema.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.type !== undefined || data.currency !== undefined,
    { message: "At least one field must be provided for update" },
  );

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactionCreateSchema = z.object({
  amount: amountSchema,
  date: dateStringSchema,
  type: transactionTypeSchema,
  category: z.string().min(1, "category is required"),
  notes: z.string().nullish(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional().default([]),
  receiptStorageId: z.string().nullish(),
});

export const transactionUpdateSchema = z.object({
  amount: amountSchema.optional(),
  date: dateStringSchema.optional(),
  type: transactionTypeSchema.optional(),
  category: z.string().min(1).optional(),
  notes: z.string().nullish(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  receiptStorageId: z.string().nullish(),
});

export const transactionListFiltersSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    category: z.string().optional(),
    tag: z.string().trim().min(1).max(30).optional(),
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

// ─── Outgoing Payment Logs ───────────────────────────────────────────────────

/** YYYY-MM-01 format for period month. */
export const periodMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "periodMonth must be YYYY-MM-01 format")
  .refine(
    (val) => {
      const [y, m] = val.split("-").map(Number);
      const date = new Date(y, m - 1, 1);
      return date.getFullYear() === y && date.getMonth() === m - 1;
    },
    { message: "periodMonth is not a valid calendar month" },
  );

export const outgoingPaymentLogCreateSchema = z.object({
  amount: amountSchema,
  paidAt: dateStringSchema,
  periodMonth: periodMonthSchema,
  notes: z.string().nullish(),
});

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
  minPaymentPercent: z.number().min(0).max(100).nullish(),
  minPaymentFloor: z.number().min(0).nullish(),
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
    minPaymentPercent: z.number().min(0).max(100).nullish(),
    minPaymentFloor: z.number().min(0).nullish(),
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
  notes: z.string().nullish(),
  loggedAt: dateStringSchema,
});

export const debtPaymentCreateSchema = z.object({
  amount: z.number().positive("payment amount must be positive"),
  paidAt: dateStringSchema,
  notes: z.string().nullish(),
});

// ─── Per-APR interest buckets ────────────────────────────────────────────────
//
// A statement may carry several APR lines (a 0% balance transfer next to
// purchases). Buckets accept camelCase or snake_case keys, matching the
// statement routes' convention of accepting both for top-level fields.

export const interestBucketSchema = z.preprocess(
  (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const v = value as Record<string, unknown>;
      return {
        type: v.type,
        label: v.label,
        balanceSubjectToInterest:
          v.balanceSubjectToInterest ?? v.balance_subject_to_interest,
        interestCharged: v.interestCharged ?? v.interest_charged,
        apr: v.apr,
      };
    }
    return value;
  },
  z.object({
    type: z.enum(INTEREST_BUCKET_TYPES),
    // Trim before the length check so trailing space cannot reject a label.
    label: z.string().trim().max(60).nullish(),
    balanceSubjectToInterest: z.number().min(0),
    interestCharged: z.number().min(0),
    apr: z.number().min(0).nullish(),
  }),
);

const interestBreakdownSchema = z
  .array(interestBucketSchema)
  .max(MAX_INTEREST_BUCKETS)
  .nullish();

const debtStatementFields = {
  periodStart: dateStringSchema,
  periodEnd: dateStringSchema,
  statementDate: dateStringSchema,
  dueDate: dateStringSchema.nullish(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  interestCharged: z.number().min(0).default(0),
  feesCharged: z.number().min(0).default(0),
  newSpending: z.number().min(0).nullish(),
  minimumPayment: z.number().min(0).nullish(),
  balanceSubjectToInterest: z.number().min(0).nullish(),
  interestBreakdown: interestBreakdownSchema,
  principalPaid: z.number().min(0).nullish(),
  interestPaid: z.number().min(0).nullish(),
  notes: z.string().nullish(),
};

export const debtStatementCreateSchema = z
  .object(debtStatementFields)
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: "period end must not be before period start",
    path: ["periodEnd"],
  });

export const debtStatementUpdateSchema = z
  .object({
    periodStart: dateStringSchema.optional(),
    periodEnd: dateStringSchema.optional(),
    statementDate: dateStringSchema.optional(),
    dueDate: dateStringSchema.nullish(),
    openingBalance: z.number().optional(),
    closingBalance: z.number().optional(),
    interestCharged: z.number().min(0).optional(),
    feesCharged: z.number().min(0).optional(),
    newSpending: z.number().min(0).nullish(),
    minimumPayment: z.number().min(0).nullish(),
    balanceSubjectToInterest: z.number().min(0).nullish(),
    interestBreakdown: interestBreakdownSchema,
    principalPaid: z.number().min(0).nullish(),
    interestPaid: z.number().min(0).nullish(),
    notes: z.string().nullish(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided for update",
  })
  .refine(
    (d) => d.periodStart == null || d.periodEnd == null || d.periodEnd >= d.periodStart,
    { message: "period end must not be before period start", path: ["periodEnd"] },
  );

// ─── Loans Given ─────────────────────────────────────────────────────────────

export const loanStatusSchema = z.enum([
  "active",
  "partially_repaid",
  "fully_repaid",
  "defaulted",
]);

export const loanGivenCreateSchema = z.object({
  borrowerName: z.string().min(1, "borrower name is required").max(200),
  amount: z.number().positive("amount must be positive"),
  loanDate: dateStringSchema,
  expectedPaybackDate: dateStringSchema.nullish(),
  interestRate: z.number().min(0).max(100).nullish(),
  notes: z.string().nullish(),
});

export const loanGivenUpdateSchema = z
  .object({
    borrowerName: z.string().min(1).max(200).optional(),
    amount: z.number().positive().optional(),
    outstandingBalance: z.number().min(0).optional(),
    loanDate: dateStringSchema.optional(),
    expectedPaybackDate: dateStringSchema.nullish(),
    status: loanStatusSchema.optional(),
    interestRate: z.number().min(0).max(100).nullish(),
    notes: z.string().nullish(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" },
  );

export const loanRepaymentCreateSchema = z.object({
  amount: z.number().positive("amount must be positive"),
  repaymentDate: dateStringSchema,
  notes: z.string().nullish(),
});

// ─── Investments & Assets ────────────────────────────────────────────────────

export const investmentTypeSchema = z.enum([
  "stock",
  "crypto",
  "forex",
  "property",
  "business",
  "savings",
  "other",
]);

export const investmentEventTypeSchema = z.enum([
  "return",
  "dividend",
  "sale",
  "partial_sale",
  "loss",
  "fee",
]);

export const investmentCreateSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
  investmentType: investmentTypeSchema,
  platform: z.string().max(200).nullish(),
  costBasis: z.number().positive("cost basis must be positive"),
  currentValue: z.number().min(0, "current value must be non-negative"),
  quantity: z.number().positive().nullish(),
  purchaseDate: dateStringSchema,
  notes: z.string().nullish(),
});

export const investmentUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    investmentType: investmentTypeSchema.optional(),
    platform: z.string().max(200).nullish(),
    costBasis: z.number().positive().optional(),
    currentValue: z.number().min(0).optional(),
    quantity: z.number().positive().nullish(),
    purchaseDate: dateStringSchema.optional(),
    notes: z.string().nullish(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" },
  );

export const investmentEventCreateSchema = z.object({
  eventType: investmentEventTypeSchema,
  amount: z.number().positive("amount must be positive"),
  eventDate: dateStringSchema,
  notes: z.string().nullish(),
});

// ─── Goals & Savings Targets ───────────────────────────────────────────────

export const goalCategorySchema = z.enum([
  "emergency_fund",
  "savings",
  "debt_payoff",
  "giving",
  "travel",
  "home",
  "education",
  "business",
  "other",
]);

export const goalCreateSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
  category: goalCategorySchema,
  targetAmount: z.number().positive("target amount must be positive"),
  currentAmount: z.number().min(0, "current amount must be non-negative").optional().default(0),
  targetDate: dateStringSchema.nullish(),
  notes: z.string().nullish(),
});

export const goalUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    category: goalCategorySchema.optional(),
    targetAmount: z.number().positive().optional(),
    currentAmount: z.number().min(0).optional(),
    targetDate: dateStringSchema.nullish(),
    notes: z.string().nullish(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" },
  );

// ─── AI Provider Settings ───────────────────────────────────────────────────

export const aiProviderSchema = z.enum([
  "openai",
  "openrouter",
  "groq",
  "together",
  "ollama",
  "custom",
]);

export const aiProviderSettingsSchema = z.object({
  provider: aiProviderSchema,
  apiEndpoint: z.string().url("Must be a valid URL").min(1, "API endpoint is required"),
  apiKey: z.string().min(1, "API key is required").optional(),
  model: z.string().min(1, "Model is required"),
  isEnabled: z.boolean().default(true),
});

export const aiProviderSettingsUpdateSchema = z.object({
  provider: aiProviderSchema.optional(),
  apiEndpoint: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
