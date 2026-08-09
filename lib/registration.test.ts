import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRegistrationDenial } from "./registration";

describe("registration policy", () => {
  it("fails closed when the setup token is not configured", () => {
    assert.equal(
      getRegistrationDenial({
        accountExists: false,
        configuredToken: undefined,
        suppliedToken: "supplied-token",
      }),
      "misconfigured",
    );
  });

  it("rejects a missing or incorrect setup token", () => {
    const request = {
      accountExists: false,
      configuredToken: "correct-token",
    };

    assert.equal(getRegistrationDenial({ ...request, suppliedToken: null }), "invalid-token");
    assert.equal(
      getRegistrationDenial({ ...request, suppliedToken: "incorrect-token" }),
      "invalid-token",
    );
  });

  it("allows the first account with the configured token", () => {
    assert.equal(
      getRegistrationDenial({
        accountExists: false,
        configuredToken: "correct-token",
        suppliedToken: "correct-token",
      }),
      null,
    );
  });

  it("rejects every subsequent account even with the configured token", () => {
    assert.equal(
      getRegistrationDenial({
        accountExists: true,
        configuredToken: "correct-token",
        suppliedToken: "correct-token",
      }),
      "closed",
    );
  });
});
