import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCurrentBudgetRange,
  getNextBudgetRange,
  getRolledBudgetAmount,
} from "./budget-periods";

describe("budget period ranges", () => {
  const now = new Date("2028-05-18T12:00:00Z");

  it("uses the complete current calendar period", () => {
    assert.deepEqual(getCurrentBudgetRange("monthly", now), {
      startDate: "2028-05-01",
      endDate: "2028-05-31",
    });
    assert.deepEqual(getCurrentBudgetRange("quarterly", now), {
      startDate: "2028-04-01",
      endDate: "2028-06-30",
    });
    assert.deepEqual(getCurrentBudgetRange("yearly", now), {
      startDate: "2028-01-01",
      endDate: "2028-12-31",
    });
  });

  it("copies monthly budgets across short months and leap years", () => {
    assert.deepEqual(getNextBudgetRange("2028-01-31", "monthly"), {
      startDate: "2028-02-01",
      endDate: "2028-02-29",
    });
    assert.deepEqual(getNextBudgetRange("2028-02-29", "monthly"), {
      startDate: "2028-03-01",
      endDate: "2028-03-31",
    });
  });

  it("copies quarterly and yearly budgets into the next calendar period", () => {
    assert.deepEqual(getNextBudgetRange("2028-06-30", "quarterly"), {
      startDate: "2028-07-01",
      endDate: "2028-09-30",
    });
    assert.deepEqual(getNextBudgetRange("2028-12-31", "yearly"), {
      startDate: "2029-01-01",
      endDate: "2029-12-31",
    });
  });

  it("adds only an unused balance to the next budget", () => {
    assert.equal(getRolledBudgetAmount(500, 125.25), 625.25);
    assert.equal(getRolledBudgetAmount(500, 0), 500);
    assert.equal(getRolledBudgetAmount(500, -75), 500);
    assert.equal(getRolledBudgetAmount(10.01, 0.02), 10.03);
  });
});
