import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  incomeProjectionCopy,
  summarizeProjectedIncome,
} from "./projected-income";

describe("projected income totals", () => {
  it("sums expected and received without netting categories", () => {
    assert.deepEqual(
      summarizeProjectedIncome([
        { amount: 2500, spent: 1200 },
        { amount: 800, spent: 800 },
      ]),
      { expected: 3300, received: 2000, outstanding: 1300 },
    );
  });

  it("reports being ahead when received passes the projection", () => {
    assert.deepEqual(
      summarizeProjectedIncome([{ amount: 1000, spent: 1250 }]),
      { expected: 1000, received: 1250, outstanding: -250 },
    );
  });
});

describe("projected income copy", () => {
  const format = (amount: number) => `£${amount}`;

  it("names money still to come, met, and ahead in words", () => {
    assert.equal(incomeProjectionCopy(400, format), "£400 still expected");
    assert.equal(incomeProjectionCopy(0, format), "On projection");
    assert.equal(
      incomeProjectionCopy(-150, format),
      "£150 ahead of projection",
    );
  });
});
