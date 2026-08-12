import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countCommitmentOccurrences } from "./giving-commitments";

describe("countCommitmentOccurrences", () => {
  it("counts monthly dates from the original anchor without drifting", () => {
    assert.equal(
      countCommitmentOccurrences({
        frequency: "monthly",
        startDate: "2026-01-31",
        endDate: null,
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
      }),
      3,
    );
  });

  it("respects reporting and commitment boundaries", () => {
    assert.equal(
      countCommitmentOccurrences({
        frequency: "quarterly",
        startDate: "2026-02-15",
        endDate: "2026-08-15",
        periodStart: "2026-04-01",
        periodEnd: "2026-12-31",
      }),
      2,
    );
    assert.equal(
      countCommitmentOccurrences({
        frequency: "one_time",
        startDate: "2026-03-01",
        endDate: null,
        periodStart: "2026-04-01",
        periodEnd: "2026-12-31",
      }),
      0,
    );
  });

  it("preserves a leap-day yearly anchor", () => {
    assert.equal(
      countCommitmentOccurrences({
        frequency: "yearly",
        startDate: "2024-02-29",
        endDate: null,
        periodStart: "2024-01-01",
        periodEnd: "2028-02-29",
      }),
      5,
    );
  });

  it("stops cleanly at the maximum supported date", () => {
    assert.equal(
      countCommitmentOccurrences({
        frequency: "monthly",
        startDate: "9999-12-31",
        endDate: null,
        periodStart: "9999-12-31",
        periodEnd: "9999-12-31",
      }),
      1,
    );
  });
});
