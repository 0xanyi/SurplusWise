import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateAccountBalance } from "./account-balance";

describe("calculateAccountBalance", () => {
  it("adds income and incoming transfers to an asset", () => {
    assert.equal(calculateAccountBalance(500, "asset", 125), 625);
  });

  it("subtracts expenses, giving, and outgoing transfers from an asset", () => {
    assert.equal(calculateAccountBalance(500, "asset", -125), 375);
  });

  it("adds purchases to the amount owed on a liability", () => {
    assert.equal(calculateAccountBalance(500, "liability", -125), 625);
  });

  it("subtracts payments and refunds from the amount owed on a liability", () => {
    assert.equal(calculateAccountBalance(500, "liability", 125), 375);
  });
});
