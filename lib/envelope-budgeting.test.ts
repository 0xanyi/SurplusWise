import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMonthlyEnvelopePlan } from "./envelope-budgeting";

describe("monthly envelope plan", () => {
  it("keeps expense and giving assignments distinct", () => {
    assert.deepEqual(
      getMonthlyEnvelopePlan(
        [
          { amount: 3000, period: "monthly", start_date: "2028-01-01", end_date: "2028-01-31", type: "income" },
          { amount: 2200, period: "monthly", start_date: "2028-01-01", end_date: "2028-01-31", type: "expense" },
          { amount: 300, period: "monthly", start_date: "2028-01-01", end_date: "2028-01-31", type: "giving" },
        ],
        { startDate: "2028-01-01", endDate: "2028-01-31" },
      ),
      { expectedIncome: 3000, expenses: 2200, giving: 300, unassigned: 500 },
    );
  });

  it("reports over-assignment as a negative balance", () => {
    assert.equal(
      getMonthlyEnvelopePlan(
        [
          { amount: 1000, period: "monthly", start_date: "2028-01-01", end_date: "2028-01-31", type: "income" },
          { amount: 900, period: "monthly", start_date: "2028-01-01", end_date: "2028-01-31", type: "expense" },
          { amount: 200, period: "monthly", start_date: "2028-01-01", end_date: "2028-01-31", type: "giving" },
        ],
        { startDate: "2028-01-01", endDate: "2028-01-31" },
      ).unassigned,
      -100,
    );
  });

  it("excludes quarterly and yearly budgets from the monthly plan", () => {
    assert.deepEqual(
      getMonthlyEnvelopePlan(
        [
          { amount: 3000, period: "monthly", start_date: "2028-01-01", end_date: "2028-01-31", type: "income" },
          { amount: 9000, period: "quarterly", start_date: "2028-01-01", end_date: "2028-03-31", type: "income" },
          { amount: 12000, period: "yearly", start_date: "2028-01-01", end_date: "2028-12-31", type: "expense" },
          { amount: 500, period: "monthly", start_date: "2027-12-01", end_date: "2027-12-31", type: "expense" },
        ],
        { startDate: "2028-01-01", endDate: "2028-01-31" },
      ),
      { expectedIncome: 3000, expenses: 0, giving: 0, unassigned: 3000 },
    );
  });
});
