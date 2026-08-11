import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const workspaceTypeEnum = pgEnum("workspace_type", [
  "personal",
  "business",
]);

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

export const loanStatusEnum = pgEnum("loan_status", [
  "active",
  "partially_repaid",
  "fully_repaid",
  "defaulted",
]);

export const investmentTypeEnum = pgEnum("investment_type", [
  "stock",
  "crypto",
  "forex",
  "property",
  "business",
  "savings",
  "other",
]);

export const investmentEventTypeEnum = pgEnum("investment_event_type", [
  "return",
  "dividend",
  "sale",
  "partial_sale",
  "loss",
  "fee",
]);

// ─── Better Auth tables ──────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    categoriesSeeded: boolean("categories_seeded").notNull().default(false),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [uniqueIndex("users_singleton").on(sql`(true)`)],
);

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

// ─── Workspaces ─────────────────────────────────────────────────────────────

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: workspaceTypeEnum("type").notNull(),
    currency: text("currency").notNull().default("GBP"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_workspaces_user").on(t.userId),
    uniqueIndex("idx_workspaces_user_name").on(t.userId, t.name),
  ],
);

export const onboardingStatus = pgTable(
  "onboarding_status",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    hasCompleted: boolean("has_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_onboarding_status_workspace").on(t.workspaceId)],
);

export const goalCategoryEnum = pgEnum("goal_category", [
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

// ─── AI Provider Settings ───────────────────────────────────────────────────

export const aiProviderSettings = pgTable(
  "ai_provider_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("openai"),
    apiEndpoint: text("api_endpoint").notNull().default("https://api.openai.com/v1"),
    apiKey: text("api_key"), // encrypted at application level
    model: text("model").notNull().default("gpt-4o-mini"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_ai_provider_settings_user").on(t.userId),
    uniqueIndex("idx_ai_provider_settings_user_unique").on(t.userId),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: goalCategoryEnum("category").notNull().default("savings"),
    targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    targetDate: date("target_date", { mode: "string" }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_goals_user_workspace").on(t.userId, t.workspaceId),
    index("idx_goals_workspace_active").on(t.workspaceId, t.isActive),
  ],
);

// ─── Domain tables ───────────────────────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    category: text("category").notNull(),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
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
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
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
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
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
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
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

// ─── Outgoing Payment Logs ───────────────────────────────────────────────────

/**
 * Tracks actual payments made against recurring outgoings.
 * One row per outgoing per month = "I paid my rent for Feb 2026".
 * The `period_month` column stores the first day of the target month (YYYY-MM-01).
 */
export const outgoingPaymentLogs = pgTable(
  "outgoing_payment_logs",
  {
    id: text("id").primaryKey(),
    outgoingId: text("outgoing_id")
      .notNull()
      .references(() => recurringOutgoings.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    paidAt: date("paid_at", { mode: "string" }).notNull(), // actual payment date
    periodMonth: date("period_month", { mode: "string" }).notNull(), // YYYY-MM-01
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_outgoing_payment_logs_user").on(t.userId, t.paidAt),
    index("idx_outgoing_payment_logs_outgoing").on(t.outgoingId, t.periodMonth),
    check(
      "chk_outgoing_payment_logs_period_month_day",
      sql`EXTRACT(DAY FROM ${t.periodMonth}) = 1`,
    ),
    // One payment per outgoing per month
    uniqueIndex("idx_outgoing_payment_logs_unique").on(t.outgoingId, t.periodMonth),
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
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Barclays Credit Card", "Car Loan"
    debtType: debtTypeEnum("debt_type").notNull(),
    lender: text("lender"), // e.g. "Barclays", "Halifax"
    currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
    creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }), // for credit cards
    interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // APR as advertised (EAR basis) %
    minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }),
    // Rule used only to forecast the next minimum when no statement exists yet.
    // FCA CONC 6.7.5R shape: interest + fees + percent% of outstanding, floored.
    // No default floor: it is currency-specific and the workspace may not be GBP.
    minPaymentPercent: decimal("min_payment_percent", { precision: 5, scale: 2 }).default("1.00"),
    minPaymentFloor: decimal("min_payment_floor", { precision: 10, scale: 2 }),
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

// Ad-hoc balance snapshots – "I checked my balance today". Payments live in
// `debt_payments` and statements in `debt_statements`; this table stays a pure
// point-in-time reading so nothing double-counts.
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
    notes: text("notes"),
    loggedAt: date("logged_at", { mode: "string" }).notNull(), // the date this snapshot is for
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debt_balance_logs_debt").on(t.debtId, t.loggedAt),
    index("idx_debt_balance_logs_user").on(t.userId),
  ],
);

// ─── Debt Payments ───────────────────────────────────────────────────────────

/**
 * One row per actual payment made against a debt. Single source of truth for
 * money paid out, so statements can reconcile against it without duplicating it.
 * Replaces the old `debt_balance_logs.payment_made` column.
 */
export const debtPayments = pgTable(
  "debt_payments",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id")
      .notNull()
      .references(() => debtsCredits.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    paidAt: date("paid_at", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debt_payments_debt").on(t.debtId, t.paidAt),
    index("idx_debt_payments_user").on(t.userId, t.paidAt),
  ],
);

// ─── Debt Statements ─────────────────────────────────────────────────────────

/**
 * One row per billing cycle. Revolving debts (credit card, overdraft) fill
 * `new_spending` and `minimum_payment`; amortising debts (loan, mortgage) fill
 * `principal_paid` and `interest_paid` instead.
 *
 * `closing_balance` is authoritative for `debts_credits.current_balance` when it
 * is the newest record. `balance_subject_to_interest` mirrors Plaid's
 * `balance_subject_to_apr`: issuers charge on an average daily balance, so when
 * the statement prints that figure the derived rate is exact rather than
 * estimated.
 */
export const debtStatements = pgTable(
  "debt_statements",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id")
      .notNull()
      .references(() => debtsCredits.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    statementDate: date("statement_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull(),
    closingBalance: decimal("closing_balance", { precision: 12, scale: 2 }).notNull(),
    interestCharged: decimal("interest_charged", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    feesCharged: decimal("fees_charged", { precision: 10, scale: 2 }).notNull().default("0"),
    newSpending: decimal("new_spending", { precision: 12, scale: 2 }), // revolving only
    minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }), // revolving only
    balanceSubjectToInterest: decimal("balance_subject_to_interest", {
      precision: 12,
      scale: 2,
    }),
    principalPaid: decimal("principal_paid", { precision: 10, scale: 2 }), // amortising only
    interestPaid: decimal("interest_paid", { precision: 10, scale: 2 }), // amortising only
    interestBreakdown: jsonb("interest_breakdown"), // reserved for per-APR buckets
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debt_statements_debt").on(t.debtId, t.periodEnd),
    index("idx_debt_statements_user").on(t.userId, t.dueDate),
    uniqueIndex("uq_debt_statements_debt_period").on(t.debtId, t.periodEnd),
    check("chk_debt_statements_period", sql`${t.periodEnd} >= ${t.periodStart}`),
  ],
);

// ─── Loans Given (Receivables) ───────────────────────────────────────────────

export const loansGiven = pgTable(
  "loans_given",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
    borrowerName: text("borrower_name").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    outstandingBalance: decimal("outstanding_balance", { precision: 12, scale: 2 }).notNull(),
    loanDate: date("loan_date", { mode: "string" }).notNull(),
    expectedPaybackDate: date("expected_payback_date", { mode: "string" }),
    status: loanStatusEnum("status").notNull().default("active"),
    interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_loans_given_user").on(t.userId, t.status),
  ],
);

export const loanRepayments = pgTable(
  "loan_repayments",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loansGiven.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    repaymentDate: date("repayment_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_loan_repayments_loan").on(t.loanId, t.repaymentDate),
    index("idx_loan_repayments_user").on(t.userId),
  ],
);

// ─── Investments & Assets ────────────────────────────────────────────────────

export const investments = pgTable(
  "investments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    investmentType: investmentTypeEnum("investment_type").notNull(),
    platform: text("platform"),
    costBasis: decimal("cost_basis", { precision: 14, scale: 2 }).notNull(),
    currentValue: decimal("current_value", { precision: 14, scale: 2 }).notNull(),
    quantity: decimal("quantity", { precision: 18, scale: 8 }),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_investments_user").on(t.userId, t.isActive),
  ],
);

export const investmentEvents = pgTable(
  "investment_events",
  {
    id: text("id").primaryKey(),
    investmentId: text("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: investmentEventTypeEnum("event_type").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_investment_events_investment").on(t.investmentId, t.eventDate),
    index("idx_investment_events_user").on(t.userId),
  ],
);
