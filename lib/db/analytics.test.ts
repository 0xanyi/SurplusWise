import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDateRange } from "./helpers";
import type { Period } from "./helpers";

// ─── getDateRange ────────────────────────────────────────────────────────────

describe("getDateRange", () => {
  it("returns a custom range when period is custom and dates provided", () => {
    const range = getDateRange("custom", {
      startDate: "2025-03-01",
      endDate: "2025-03-31",
    });
    assert.strictEqual(range.startDate, "2025-03-01");
    assert.strictEqual(range.endDate, "2025-03-31");
  });

  it("falls back to month when custom but dates missing", () => {
    const range = getDateRange("custom");
    // Should fallback to month-based default (endDate = today)
    assert.ok(range.startDate.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(range.endDate.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(range.startDate < range.endDate);
  });

  // Verify each named period produces sensible date ranges
  const periods: Period[] = [
    "week",
    "weekly",
    "month",
    "monthly",
    "quarter",
    "quarterly",
    "year",
    "yearly",
  ];

  for (const period of periods) {
    it(`"${period}" produces a valid date range`, () => {
      const range = getDateRange(period);
      // Both dates should be YYYY-MM-DD
      assert.match(range.startDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(range.endDate, /^\d{4}-\d{2}-\d{2}$/);
      // Start must be before end
      assert.ok(
        range.startDate <= range.endDate,
        `startDate (${range.startDate}) should be <= endDate (${range.endDate})`,
      );
    });
  }

  it('"week"/"weekly" span is roughly 7 days', () => {
    const range = getDateRange("week");
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(days >= 6 && days <= 8, `Expected ~7 days, got ${days}`);
  });

  it('"year"/"yearly" span is roughly 365 days', () => {
    const range = getDateRange("year");
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(
      days >= 364 && days <= 367,
      `Expected ~365 days, got ${days}`,
    );
  });

  it('"quarter"/"quarterly" span is roughly 90 days', () => {
    const range = getDateRange("quarter");
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(
      days >= 89 && days <= 93,
      `Expected ~90 days, got ${days}`,
    );
  });

  it("endDate is today for named periods", () => {
    const today = new Date().toISOString().split("T")[0];
    for (const period of ["week", "month", "year"] as Period[]) {
      const range = getDateRange(period);
      assert.strictEqual(range.endDate, today, `${period} endDate`);
    }
  });
});
