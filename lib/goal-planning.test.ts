import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGoalFundingPlan } from "./goal-planning";

describe("goal funding plans", () => {
  it("calculates a monthly contribution that reaches a dated target", () => {
    assert.deepEqual(getGoalFundingPlan(1200, 200, "2028-06-30", "2028-01-01"), {
      fundingStatus: "scheduled",
      monthsRemaining: 6,
      monthlyContribution: 166.67,
    });
  });

  it("uses one contribution when the target is less than a month away", () => {
    assert.deepEqual(getGoalFundingPlan(500, 125, "2028-01-20", "2028-01-01"), {
      fundingStatus: "scheduled",
      monthsRemaining: 1,
      monthlyContribution: 375,
    });
  });

  it("marks unfinished past targets overdue", () => {
    assert.deepEqual(getGoalFundingPlan(500, 125, "2027-12-31", "2028-01-01"), {
      fundingStatus: "overdue",
      monthsRemaining: 0,
      monthlyContribution: 375,
    });
  });

  it("marks fully funded targets complete before considering their date", () => {
    assert.deepEqual(getGoalFundingPlan(500, 500, "2027-12-31", "2028-01-01"), {
      fundingStatus: "complete",
      monthsRemaining: 0,
      monthlyContribution: 0,
    });
  });

  it("does not invent a contribution schedule without a target date", () => {
    assert.deepEqual(getGoalFundingPlan(500, 100, null, "2028-01-01"), {
      fundingStatus: "undated",
      monthsRemaining: null,
      monthlyContribution: null,
    });
  });
});
