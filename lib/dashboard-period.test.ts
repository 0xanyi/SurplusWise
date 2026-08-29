import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  budgetApiPeriod,
  budgetBandTitle,
  parseDashboardPeriod,
  registerHref,
} from "./dashboard-period";

describe("parseDashboardPeriod", () => {
  it("defaults unknown values to month", () => {
    assert.equal(parseDashboardPeriod(null), "month");
    assert.equal(parseDashboardPeriod("nope"), "month");
    assert.equal(parseDashboardPeriod("year"), "year");
  });
});

describe("budgetApiPeriod", () => {
  it("maps trailing windows onto budget grains", () => {
    assert.equal(budgetApiPeriod("week"), "monthly");
    assert.equal(budgetApiPeriod("month"), "monthly");
    assert.equal(budgetApiPeriod("quarter"), "quarterly");
    assert.equal(budgetApiPeriod("year"), "yearly");
  });
});

describe("budgetBandTitle", () => {
  it("does not say this month for a year-long window", () => {
    assert.equal(budgetBandTitle("year", "budgets"), "Budgets this year");
    assert.equal(budgetBandTitle("year", "income"), "Projected income this year");
    assert.equal(budgetBandTitle("month", "budgets"), "Budgets this month");
  });
});

describe("registerHref", () => {
  it("deep-links type and category onto the register", () => {
    assert.equal(
      registerHref({ type: "expense", category: "Food & Dining" }),
      "/dashboard/transactions?type=expense&category=Food+%26+Dining",
    );
  });
});
