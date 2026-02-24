import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "giving",
]);

export const budgetPeriodEnum = pgEnum("budget_period", [
  "monthly",
  "quarterly",
  "yearly",
]);

export const outgoingFrequencyEnum = pgEnum("outgoing_frequency", [
  "monthly",
  "quarterly",
  "yearly",
]);

export const debtTypeEnum = pgEnum("debt_type", [
  "credit_card",
  "loan",
  "mortgage",
  "overdraft",
  "other",
]);

// ─── Better Auth tables ──────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  categoriesSeeded: boolean("categories_seeded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_user_id").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_accounts_user_id").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_verifications_identifier").on(t.identifier)],
);

// ─── Domain tables ───────────────────────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    category: text("category").notNull(),
    notes: text("notes"),
    receiptStorageId: text("receipt_storage_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_transactions_user_date").on(t.userId, t.date.desc()),
    index("idx_transactions_user_type_date").on(t.userId, t.type, t.date.desc()),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: transactionTypeEnum("type").notNull(),
    color: text("color").notNull(),
    icon: text("icon"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_categories_user_type_name").on(t.userId, t.type, t.name),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    period: budgetPeriodEnum("period").notNull().default("monthly"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    type: transactionTypeEnum("type").notNull().default("expense"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_budgets_user_active").on(t.userId, t.isActive),
  ],
);

// ─── Recurring Outgoings ─────────────────────────────────────────────────────

export const recurringOutgoings = pgTable(
  "recurring_outgoings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    dayOfMonth: integer("day_of_month").notNull(), // 1-31
    frequency: outgoingFrequencyEnum("frequency").notNull().default("monthly"),
    category: text("category"), // optional grouping e.g. "Housing", "Utilities"
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recurring_outgoings_user").on(t.userId, t.isActive),
    check("chk_recurring_outgoings_day_of_month", sql`${t.dayOfMonth} BETWEEN 1 AND 31`),
  ],
);

// ─── Debts & Credits ─────────────────────────────────────────────────────────

export const debtsCredits = pgTable(
  "debts_credits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Barclays Credit Card", "Car Loan"
    debtType: debtTypeEnum("debt_type").notNull(),
    lender: text("lender"), // e.g. "Barclays", "Halifax"
    currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
    creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }), // for credit cards
    interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // APR %
    minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }),
    paymentDayOfMonth: integer("payment_day_of_month"), // 1-31
    startDate: date("start_date", { mode: "string" }), // when the loan/credit started
    endDate: date("end_date", { mode: "string" }), // expected payoff date
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debts_credits_user").on(t.userId, t.isActive),
    check(
      "chk_debts_credits_payment_day_of_month",
      sql`${t.paymentDayOfMonth} IS NULL OR ${t.paymentDayOfMonth} BETWEEN 1 AND 31`,
    ),
  ],
);

// Balance snapshots – log how the balance changes over time
export const debtBalanceLogs = pgTable(
  "debt_balance_logs",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id")
      .notNull()
      .references(() => debtsCredits.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    balance: decimal("balance", { precision: 12, scale: 2 }).notNull(),
    paymentMade: decimal("payment_made", { precision: 10, scale: 2 }), // optional
    notes: text("notes"),
    loggedAt: date("logged_at", { mode: "string" }).notNull(), // the date this snapshot is for
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debt_balance_logs_debt").on(t.debtId, t.loggedAt),
    index("idx_debt_balance_logs_user").on(t.userId),
  ],
);
