import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBudgetUsage,
  getMissingDefaults,
  getMissingDefaultsByType,
} from "./helpers";
import type { DefaultCategory, TransactionType } from "./default-categories";

// ─── computeBudgetUsage ──────────────────────────────────────────────────────

describe("computeBudgetUsage", () => {
  it("returns correct remaining and percent for normal spend", () => {
    const result = computeBudgetUsage(500, 200);
    assert.strictEqual(result.spent, 200);
    assert.strictEqual(result.remaining, 300);
    assert.strictEqual(result.percentUsed, 40);
  });

  it("returns 100% when fully spent", () => {
    const result = computeBudgetUsage(500, 500);
    assert.strictEqual(result.remaining, 0);
    assert.strictEqual(result.percentUsed, 100);
  });

  it("returns negative remaining when over budget", () => {
    const result = computeBudgetUsage(500, 750);
    assert.strictEqual(result.remaining, -250);
    assert.strictEqual(result.percentUsed, 150);
  });

  it("returns 0% when budget amount is 0", () => {
    const result = computeBudgetUsage(0, 100);
    assert.strictEqual(result.percentUsed, 0);
    assert.strictEqual(result.remaining, -100);
  });

  it("handles zero spend", () => {
    const result = computeBudgetUsage(1000, 0);
    assert.strictEqual(result.spent, 0);
    assert.strictEqual(result.remaining, 1000);
    assert.strictEqual(result.percentUsed, 0);
  });

  it("handles fractional amounts", () => {
    const result = computeBudgetUsage(100, 33.33);
    assert.ok(Math.abs(result.remaining - 66.67) < 0.001);
    assert.ok(Math.abs(result.percentUsed - 33.33) < 0.001);
  });
});

// ─── getMissingDefaults ──────────────────────────────────────────────────────

const sampleDefaults: DefaultCategory[] = [
  { name: "Food", color: "#ef4444", icon: "utensils" },
  { name: "Transport", color: "#f97316", icon: "car" },
  { name: "Shopping", color: "#eab308", icon: "shopping-bag" },
];

describe("getMissingDefaults", () => {
  it("returns all defaults when no existing", () => {
    const result = getMissingDefaults([], sampleDefaults);
    assert.strictEqual(result.missing.length, 3);
  });

  it("returns empty when all exist", () => {
    const result = getMissingDefaults(
      ["Food", "Transport", "Shopping"],
      sampleDefaults,
    );
    assert.strictEqual(result.missing.length, 0);
  });

  it("is case-insensitive", () => {
    const result = getMissingDefaults(
      ["food", "TRANSPORT"],
      sampleDefaults,
    );
    assert.strictEqual(result.missing.length, 1);
    assert.strictEqual(result.missing[0].name, "Shopping");
  });

  it("returns only missing ones", () => {
    const result = getMissingDefaults(["Food"], sampleDefaults);
    assert.strictEqual(result.missing.length, 2);
    assert.deepStrictEqual(
      result.missing.map((c) => c.name),
      ["Transport", "Shopping"],
    );
  });
});

// ─── getMissingDefaultsByType ────────────────────────────────────────────────

describe("getMissingDefaultsByType", () => {
  const allDefaults: Record<TransactionType, DefaultCategory[]> = {
    expense: sampleDefaults,
    giving: [{ name: "Tithe", color: "#8b5cf6", icon: "church" }],
    income: [{ name: "Salary", color: "#10b981", icon: "banknote" }],
  };

  it("computes diff for all types", () => {
    const result = getMissingDefaultsByType(
      {
        expense: ["Food"],
        giving: [],
        income: ["Salary"],
      },
      allDefaults,
    );

    assert.strictEqual(result.expense.missing.length, 2);
    assert.strictEqual(result.giving.missing.length, 1);
    assert.strictEqual(result.income.missing.length, 0);
  });

  it("handles empty existing for all types", () => {
    const result = getMissingDefaultsByType(
      { expense: [], giving: [], income: [] },
      allDefaults,
    );
    assert.strictEqual(result.expense.missing.length, 3);
    assert.strictEqual(result.giving.missing.length, 1);
    assert.strictEqual(result.income.missing.length, 1);
  });
});
