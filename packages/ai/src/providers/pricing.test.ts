import { describe, expect, it } from "vitest";

import { calculateEstimatedCost } from "./pricing.js";

describe("calculateEstimatedCost", () => {
  it("calculates cost from exact provider pricing", () => {
    expect(calculateEstimatedCost({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000,
      outputTokens: 500,
    })).toBe(0.00045);
  });

  it("returns null when pricing is unknown or usage is unavailable", () => {
    expect(calculateEstimatedCost({ provider: "openai", model: "future-model", inputTokens: 100, outputTokens: 100 })).toBeNull();
    expect(calculateEstimatedCost({ provider: "openai", model: "gpt-4o", inputTokens: null, outputTokens: 100 })).toBeNull();
  });
});
