import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  userIdSchema,
  idSchema,
  dateStringSchema,
  amountSchema,
  limitSchema,
  pageSchema,
  pageSizeSchema,
  transactionTypeSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionBulkUpdateSchema,
  transactionListFiltersSchema,
  financialAccountCreateSchema,
  accountTransferCreateSchema,
  accountReconciliationSchema,
  transactionImportProfileCreateSchema,
  transactionRuleCreateSchema,
  givingRecipientCreateSchema,
  givingDesignationCreateSchema,
  givingCommitmentCreateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  budgetPeriodSchema,
  budgetCreateSchema,
  budgetUpdateSchema,
  analyticsPeriodSchema,
  analyticsQuerySchema,
  debtStatementCreateSchema,
  debtStatementUpdateSchema,
} from "./validation";

// ─── Shared primitives ───────────────────────────────────────────────────────

describe("userIdSchema", () => {
  it("accepts a non-empty string", () => {
    assert.doesNotThrow(() => userIdSchema.parse("user_123"));
  });
  it("rejects empty string", () => {
    assert.throws(() => userIdSchema.parse(""));
  });
});

describe("idSchema", () => {
  it("accepts a UUID string", () => {
    assert.doesNotThrow(() =>
      idSchema.parse("550e8400-e29b-41d4-a716-446655440000"),
    );
  });
  it("accepts a cuid-style string", () => {
    assert.doesNotThrow(() => idSchema.parse("clxyz1234abc"));
  });
  it("accepts a nanoid-style string", () => {
    assert.doesNotThrow(() => idSchema.parse("V1StGXR8_Z5jdHi6B-myT"));
  });
  it("accepts a plain numeric string", () => {
    assert.doesNotThrow(() => idSchema.parse("12345"));
  });
  it("rejects empty string", () => {
    assert.throws(() => idSchema.parse(""));
  });
});

describe("dateStringSchema", () => {
  it("accepts YYYY-MM-DD", () => {
    assert.doesNotThrow(() => dateStringSchema.parse("2025-06-15"));
  });
  it("rejects MM/DD/YYYY", () => {
    assert.throws(() => dateStringSchema.parse("06/15/2025"));
  });
  it("rejects ISO with time", () => {
    assert.throws(() => dateStringSchema.parse("2025-06-15T00:00:00Z"));
  });
  it("rejects Feb 30 (impossible date)", () => {
    assert.throws(() => dateStringSchema.parse("2025-02-30"));
  });
  it("rejects Feb 29 on non-leap year", () => {
    assert.throws(() => dateStringSchema.parse("2025-02-29"));
  });
  it("accepts Feb 29 on leap year", () => {
    assert.doesNotThrow(() => dateStringSchema.parse("2024-02-29"));
  });
  it("rejects month 13", () => {
    assert.throws(() => dateStringSchema.parse("2025-13-01"));
  });
  it("rejects day 00", () => {
    assert.throws(() => dateStringSchema.parse("2025-01-00"));
  });
  it("rejects Apr 31 (30-day month)", () => {
    assert.throws(() => dateStringSchema.parse("2025-04-31"));
  });
});

describe("amountSchema", () => {
  it("accepts positive number", () => {
    assert.doesNotThrow(() => amountSchema.parse(42.5));
  });
  it("rejects zero", () => {
    assert.throws(() => amountSchema.parse(0));
  });
  it("rejects negative", () => {
    assert.throws(() => amountSchema.parse(-10));
  });
});

describe("transactionTypeSchema", () => {
  for (const t of ["expense", "giving", "income"]) {
    it(`accepts "${t}"`, () => {
      assert.doesNotThrow(() => transactionTypeSchema.parse(t));
    });
  }
  it('rejects "debit"', () => {
    assert.throws(() => transactionTypeSchema.parse("debit"));
  });
});

describe("financial account schemas", () => {
  const checking = {
    name: "Main account",
    accountClass: "asset" as const,
    accountType: "checking" as const,
    currency: "GBP",
    openingBalance: 250,
    openingDate: "2026-01-01",
  };

  it("accepts an asset account", () => {
    assert.doesNotThrow(() => financialAccountCreateSchema.parse(checking));
  });

  it("rejects an asset type declared as a liability", () => {
    assert.throws(() =>
      financialAccountCreateSchema.parse({ ...checking, accountClass: "liability" }),
    );
  });

  it("accepts a credit card liability", () => {
    assert.doesNotThrow(() =>
      financialAccountCreateSchema.parse({
        ...checking,
        accountClass: "liability",
        accountType: "credit_card",
      }),
    );
  });

  it("rejects transfers to the same account", () => {
    assert.throws(() =>
      accountTransferCreateSchema.parse({
        fromAccountId: "same",
        toAccountId: "same",
        amount: 10,
        date: "2026-01-02",
      }),
    );
  });

  it("accepts a zero statement balance", () => {
    assert.doesNotThrow(() =>
      accountReconciliationSchema.parse({
        statementDate: "2026-01-31",
        statementBalance: 0,
      }),
    );
  });
});

describe("transaction import profile schema", () => {
  const profile = {
    name: "Current account",
    accountId: "account-1",
    mapping: { date: "Posted date", amount: "Amount", payee: "Merchant" },
  };

  it("accepts a signed-amount mapping", () => {
    assert.doesNotThrow(() => transactionImportProfileCreateSchema.parse(profile));
  });

  it("accepts separate debit and credit mappings", () => {
    assert.doesNotThrow(() =>
      transactionImportProfileCreateSchema.parse({
        ...profile,
        mapping: { date: "Date", debit: "Money out", credit: "Money in" },
      }),
    );
  });

  it("rejects mappings that mix signed and split amounts", () => {
    assert.throws(() =>
      transactionImportProfileCreateSchema.parse({
        ...profile,
        mapping: { date: "Date", amount: "Amount", debit: "Debit" },
      }),
    );
  });
});

describe("transaction rule schema", () => {
  it("accepts a contains match with classification actions", () => {
    assert.doesNotThrow(() =>
      transactionRuleCreateSchema.parse({
        name: "Coffee",
        matchField: "payee",
        matchValue: "cafe",
        transactionType: "expense",
        category: "Food",
        tags: ["coffee"],
        markReviewed: true,
      }),
    );
  });

  it("requires at least one action", () => {
    assert.throws(() =>
      transactionRuleCreateSchema.parse({
        name: "No-op",
        matchField: "notes",
        matchValue: "test",
      }),
    );
  });
});

describe("giving recipient schemas", () => {
  it("accepts recipient and designation names", () => {
    assert.equal(givingRecipientCreateSchema.parse({ name: " Community Church " }).name, "Community Church");
    assert.equal(
      givingDesignationCreateSchema.parse({ recipientId: "recipient-1", name: " Building fund " }).name,
      "Building fund",
    );
  });

  it("rejects blank names", () => {
    assert.throws(() => givingRecipientCreateSchema.parse({ name: " " }));
    assert.throws(() =>
      givingDesignationCreateSchema.parse({ recipientId: "recipient-1", name: " " }),
    );
  });
});

describe("giving commitment schema", () => {
  it("accepts bounded recurring commitments", () => {
    assert.doesNotThrow(() =>
      givingCommitmentCreateSchema.parse({
        recipientId: "recipient-1",
        name: "Partnership",
        amount: 50,
        frequency: "monthly",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      }),
    );
  });

  it("rejects inverted dates and non-positive amounts", () => {
    assert.throws(() =>
      givingCommitmentCreateSchema.parse({
        recipientId: "recipient-1",
        name: "Broken",
        amount: 0,
        frequency: "monthly",
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      }),
    );
  });
});

// ─── Pagination primitives ───────────────────────────────────────────────────

describe("limitSchema", () => {
  it("accepts 1", () => {
    assert.doesNotThrow(() => limitSchema.parse(1));
  });
  it("accepts 100", () => {
    assert.doesNotThrow(() => limitSchema.parse(100));
  });
  it("rejects 0", () => {
    assert.throws(() => limitSchema.parse(0));
  });
  it("rejects negative", () => {
    assert.throws(() => limitSchema.parse(-1));
  });
  it("rejects non-integer", () => {
    assert.throws(() => limitSchema.parse(2.5));
  });
  it("rejects > 100", () => {
    assert.throws(() => limitSchema.parse(101));
  });
});

describe("pageSchema", () => {
  it("accepts 0", () => {
    assert.doesNotThrow(() => pageSchema.parse(0));
  });
  it("accepts positive integer", () => {
    assert.doesNotThrow(() => pageSchema.parse(10));
  });
  it("rejects negative", () => {
    assert.throws(() => pageSchema.parse(-1));
  });
  it("rejects non-integer", () => {
    assert.throws(() => pageSchema.parse(1.5));
  });
});

describe("pageSizeSchema", () => {
  it("accepts 1", () => {
    assert.doesNotThrow(() => pageSizeSchema.parse(1));
  });
  it("accepts 100", () => {
    assert.doesNotThrow(() => pageSizeSchema.parse(100));
  });
  it("rejects 0", () => {
    assert.throws(() => pageSizeSchema.parse(0));
  });
  it("rejects negative", () => {
    assert.throws(() => pageSizeSchema.parse(-5));
  });
  it("rejects non-integer", () => {
    assert.throws(() => pageSizeSchema.parse(25.5));
  });
  it("rejects > 100", () => {
    assert.throws(() => pageSizeSchema.parse(101));
  });
});

// ─── Transaction schemas ─────────────────────────────────────────────────────

describe("transactionCreateSchema", () => {
  const valid = {
    amount: 100,
    date: "2025-01-15",
    type: "expense" as const,
    category: "Food",
  };

  it("accepts valid input", () => {
    assert.doesNotThrow(() => transactionCreateSchema.parse(valid));
  });
  it("accepts optional notes", () => {
    assert.doesNotThrow(() =>
      transactionCreateSchema.parse({ ...valid, notes: "lunch" }),
    );
  });
  it("rejects missing category", () => {
    assert.throws(() =>
      transactionCreateSchema.parse({ ...valid, category: undefined }),
    );
  });
  it("rejects negative amount", () => {
    assert.throws(() =>
      transactionCreateSchema.parse({ ...valid, amount: -5 }),
    );
  });
  it("rejects bad date format", () => {
    assert.throws(() =>
      transactionCreateSchema.parse({ ...valid, date: "Jan 15" }),
    );
  });
  it("rejects impossible calendar date", () => {
    assert.throws(() =>
      transactionCreateSchema.parse({ ...valid, date: "2025-02-30" }),
    );
  });
});

describe("transactionUpdateSchema", () => {
  it("accepts empty object (all optional)", () => {
    assert.doesNotThrow(() => transactionUpdateSchema.parse({}));
  });
  it("accepts partial update", () => {
    assert.doesNotThrow(() =>
      transactionUpdateSchema.parse({ amount: 50, notes: null }),
    );
  });
  it("rejects bad type", () => {
    assert.throws(() =>
      transactionUpdateSchema.parse({ type: "refund" }),
    );
  });
  it("rejects impossible calendar date in update", () => {
    assert.throws(() =>
      transactionUpdateSchema.parse({ date: "2025-06-31" }),
    );
  });
});

describe("transactionBulkUpdateSchema", () => {
  it("accepts metadata and review updates", () => {
    assert.doesNotThrow(() =>
      transactionBulkUpdateSchema.parse({
        ids: ["transaction-1", "transaction-2"],
        category: "Groceries",
        needsReview: false,
      }),
    );
  });

  it("rejects an empty change or an empty selection", () => {
    assert.throws(() =>
      transactionBulkUpdateSchema.parse({ ids: ["transaction-1"] }),
    );
    assert.throws(() =>
      transactionBulkUpdateSchema.parse({ ids: [], needsReview: false }),
    );
  });
});

describe("transactionListFiltersSchema", () => {
  it("defaults to empty object when undefined", () => {
    const result = transactionListFiltersSchema.parse(undefined);
    assert.deepStrictEqual(result, {});
  });
  it("passes through valid filters", () => {
    const filters = { type: "income" as const, startDate: "2025-01-01" };
    assert.doesNotThrow(() => transactionListFiltersSchema.parse(filters));
  });
  it("rejects inverted date range", () => {
    assert.throws(() =>
      transactionListFiltersSchema.parse({
        startDate: "2025-06-01",
        endDate: "2025-01-01",
      }),
    );
  });
  it("accepts valid date range", () => {
    assert.doesNotThrow(() =>
      transactionListFiltersSchema.parse({
        startDate: "2025-01-01",
        endDate: "2025-06-01",
      }),
    );
  });
  it("accepts single startDate without endDate", () => {
    assert.doesNotThrow(() =>
      transactionListFiltersSchema.parse({ startDate: "2025-01-01" }),
    );
  });
});

// ─── Category schemas ────────────────────────────────────────────────────────

describe("categoryCreateSchema", () => {
  const valid = {
    name: "Coffee",
    type: "expense" as const,
    color: "#ab12ef",
  };

  it("accepts valid input", () => {
    assert.doesNotThrow(() => categoryCreateSchema.parse(valid));
  });
  it("rejects empty name", () => {
    assert.throws(() =>
      categoryCreateSchema.parse({ ...valid, name: "" }),
    );
  });
  it("rejects invalid hex color", () => {
    assert.throws(() =>
      categoryCreateSchema.parse({ ...valid, color: "red" }),
    );
  });
  it("accepts optional icon", () => {
    assert.doesNotThrow(() =>
      categoryCreateSchema.parse({ ...valid, icon: "coffee" }),
    );
  });
});

describe("categoryUpdateSchema", () => {
  it("rejects empty object (at least one field required)", () => {
    assert.throws(() => categoryUpdateSchema.parse({}));
  });
  it("accepts name-only update", () => {
    assert.doesNotThrow(() =>
      categoryUpdateSchema.parse({ name: "Renamed" }),
    );
  });
  it("accepts color-only update", () => {
    assert.doesNotThrow(() =>
      categoryUpdateSchema.parse({ color: "#aabbcc" }),
    );
  });
  it("accepts icon-only update (including null)", () => {
    assert.doesNotThrow(() =>
      categoryUpdateSchema.parse({ icon: null }),
    );
  });
  it("rejects invalid color when provided", () => {
    assert.throws(() => categoryUpdateSchema.parse({ color: "nope" }));
  });
});

// ─── Budget schemas ──────────────────────────────────────────────────────────

describe("budgetPeriodSchema", () => {
  for (const p of ["monthly", "quarterly", "yearly"]) {
    it(`accepts "${p}"`, () => {
      assert.doesNotThrow(() => budgetPeriodSchema.parse(p));
    });
  }
  it('rejects "weekly"', () => {
    assert.throws(() => budgetPeriodSchema.parse("weekly"));
  });
});

describe("budgetCreateSchema", () => {
  const valid = {
    category: "Food",
    amount: 500,
    period: "monthly" as const,
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    type: "expense" as const,
  };

  it("accepts valid input", () => {
    assert.doesNotThrow(() => budgetCreateSchema.parse(valid));
  });
  it("rejects missing endDate", () => {
    assert.throws(() =>
      budgetCreateSchema.parse({ ...valid, endDate: undefined }),
    );
  });
  it("rejects inverted date range", () => {
    assert.throws(() =>
      budgetCreateSchema.parse({
        ...valid,
        startDate: "2025-03-01",
        endDate: "2025-01-01",
      }),
    );
  });
  it("accepts same start and end date", () => {
    assert.doesNotThrow(() =>
      budgetCreateSchema.parse({
        ...valid,
        startDate: "2025-01-15",
        endDate: "2025-01-15",
      }),
    );
  });
  it("rejects impossible calendar date in budget dates", () => {
    assert.throws(() =>
      budgetCreateSchema.parse({
        ...valid,
        startDate: "2025-02-30",
      }),
    );
  });
});

describe("budgetUpdateSchema", () => {
  it("accepts partial update", () => {
    assert.doesNotThrow(() =>
      budgetUpdateSchema.parse({ amount: 600, isActive: false }),
    );
  });
  it("rejects zero amount", () => {
    assert.throws(() => budgetUpdateSchema.parse({ amount: 0 }));
  });
  it("rejects inverted date range when both provided", () => {
    assert.throws(() =>
      budgetUpdateSchema.parse({
        startDate: "2025-12-01",
        endDate: "2025-01-01",
      }),
    );
  });
  it("accepts valid date range in update", () => {
    assert.doesNotThrow(() =>
      budgetUpdateSchema.parse({
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      }),
    );
  });
  it("allows single date field in update (no cross-check)", () => {
    assert.doesNotThrow(() =>
      budgetUpdateSchema.parse({ startDate: "2025-06-01" }),
    );
  });
});

// ─── Analytics schemas ───────────────────────────────────────────────────────

describe("analyticsPeriodSchema", () => {
  for (const p of [
    "week",
    "weekly",
    "month",
    "monthly",
    "quarter",
    "quarterly",
    "year",
    "yearly",
    "custom",
  ]) {
    it(`accepts "${p}"`, () => {
      assert.doesNotThrow(() => analyticsPeriodSchema.parse(p));
    });
  }
});

describe("analyticsQuerySchema", () => {
  it("accepts named period without dates", () => {
    assert.doesNotThrow(() =>
      analyticsQuerySchema.parse({ period: "month" }),
    );
  });
  it("accepts both supported comparison baselines", () => {
    for (const comparison of ["previous-period", "previous-year"]) {
      assert.doesNotThrow(() =>
        analyticsQuerySchema.parse({ period: "year", comparison }),
      );
    }
  });
  it("rejects an unsupported comparison baseline", () => {
    assert.throws(() =>
      analyticsQuerySchema.parse({ period: "year", comparison: "all-time" }),
    );
  });
  it("accepts custom with both dates", () => {
    assert.doesNotThrow(() =>
      analyticsQuerySchema.parse({
        period: "custom",
        startDate: "2025-01-01",
        endDate: "2025-03-31",
      }),
    );
  });
  it("rejects custom without dates", () => {
    assert.throws(() =>
      analyticsQuerySchema.parse({ period: "custom" }),
    );
  });
  it("rejects custom with only startDate", () => {
    assert.throws(() =>
      analyticsQuerySchema.parse({ period: "custom", startDate: "2025-01-01" }),
    );
  });
  it("rejects custom with inverted date range", () => {
    assert.throws(() =>
      analyticsQuerySchema.parse({
        period: "custom",
        startDate: "2025-06-01",
        endDate: "2025-01-01",
      }),
    );
  });
  it("rejects impossible calendar date in custom range", () => {
    assert.throws(() =>
      analyticsQuerySchema.parse({
        period: "custom",
        startDate: "2025-02-30",
        endDate: "2025-03-31",
      }),
    );
  });
  it("accepts custom with same start and end date", () => {
    assert.doesNotThrow(() =>
      analyticsQuerySchema.parse({
        period: "custom",
        startDate: "2025-05-15",
        endDate: "2025-05-15",
      }),
    );
  });
});

// ─── Debt statement interest breakdown ───────────────────────────────────────

const validStatement = {
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  statementDate: "2026-05-31",
  openingBalance: 1000,
  closingBalance: 900,
};

const btBucket = {
  type: "balance_transfer",
  balanceSubjectToInterest: 2000,
  interestCharged: 0,
  apr: 0,
};

describe("debtStatementCreateSchema interestBreakdown", () => {
  it("accepts a statement without a breakdown", () => {
    const parsed = debtStatementCreateSchema.parse(validStatement);
    assert.strictEqual(parsed.interestBreakdown, undefined);
  });

  it("accepts a valid breakdown", () => {
    const parsed = debtStatementCreateSchema.parse({
      ...validStatement,
      interestBreakdown: [
        btBucket,
        {
          type: "purchases",
          label: "Everyday spend",
          balanceSubjectToInterest: 500,
          interestCharged: 10.5,
        },
      ],
    });
    assert.strictEqual(parsed.interestBreakdown?.length, 2);
  });

  it("accepts snake_case bucket keys and normalises them to camelCase", () => {
    const parsed = debtStatementCreateSchema.parse({
      ...validStatement,
      interestBreakdown: [
        {
          type: "purchases",
          balance_subject_to_interest: 500,
          interest_charged: 10.5,
        },
      ],
    });
    const bucket = parsed.interestBreakdown?.[0];
    assert.strictEqual(bucket?.type, "purchases");
    assert.strictEqual(bucket?.balanceSubjectToInterest, 500);
    assert.strictEqual(bucket?.interestCharged, 10.5);
  });

  it("rejects a bad bucket type", () => {
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          { type: "mortgage", balanceSubjectToInterest: 1, interestCharged: 1 },
        ],
      }),
    );
  });

  it("rejects negative and non-finite bucket figures", () => {
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          { type: "purchases", balanceSubjectToInterest: -1, interestCharged: 1 },
        ],
      }),
    );
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          {
            type: "purchases",
            balanceSubjectToInterest: 100,
            interestCharged: Number.POSITIVE_INFINITY,
          },
        ],
      }),
    );
  });

  it("rejects more than 8 buckets", () => {
    const bucket = { type: "other", balanceSubjectToInterest: 1, interestCharged: 1 };
    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: Array.from({ length: 9 }, () => bucket),
      }),
    );
    assert.doesNotThrow(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: Array.from({ length: 8 }, () => bucket),
      }),
    );
  });

  it("trims labels before the 60-char limit and rejects overlong ones", () => {
    const padded = `${"x".repeat(59)}   `;
    const parsed = debtStatementCreateSchema.parse({
      ...validStatement,
      interestBreakdown: [
        { type: "other", label: padded, balanceSubjectToInterest: 1, interestCharged: 1 },
      ],
    });
    assert.strictEqual(parsed.interestBreakdown?.[0].label, "x".repeat(59));

    assert.throws(() =>
      debtStatementCreateSchema.parse({
        ...validStatement,
        interestBreakdown: [
          {
            type: "other",
            label: "x".repeat(61),
            balanceSubjectToInterest: 1,
            interestCharged: 1,
          },
        ],
      }),
    );
  });

  it("update schema distinguishes omitted, null (clear), and replace", () => {
    assert.strictEqual(
      debtStatementUpdateSchema.parse({ notes: "x" }).interestBreakdown,
      undefined,
    );
    assert.strictEqual(
      debtStatementUpdateSchema.parse({ interestBreakdown: null }).interestBreakdown,
      null,
    );
    assert.strictEqual(
      debtStatementUpdateSchema.parse({ interestBreakdown: [btBucket] })
        .interestBreakdown?.length,
      1,
    );
    // An empty patch is still rejected
    assert.throws(() => debtStatementUpdateSchema.parse({}));
  });
});
