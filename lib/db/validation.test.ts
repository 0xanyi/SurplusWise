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
  transactionListFiltersSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  budgetPeriodSchema,
  budgetCreateSchema,
  budgetUpdateSchema,
  analyticsPeriodSchema,
  analyticsQuerySchema,
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
