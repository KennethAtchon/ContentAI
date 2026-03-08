/**
 * Calculator permissions – re-exports and hasCalculatorAccess.
 */
import { describe, expect, test } from "bun:test";
import {
  CALCULATOR_TIER_REQUIREMENTS,
  getRequiredTierForCalculator,
  hasCalculatorAccess,
  isFeatureFree,
  hasTierAccess,
  getAccessibleCalculators,
} from "@/utils/permissions/calculator-permissions";

describe("calculator-permissions", () => {
  test("CALCULATOR_TIER_REQUIREMENTS matches core", () => {
    expect(CALCULATOR_TIER_REQUIREMENTS.mortgage).toBeNull();
    expect(CALCULATOR_TIER_REQUIREMENTS.loan).toBe("basic");
  });

  test("getRequiredTierForCalculator matches getRequiredTierForFeature", () => {
    expect(getRequiredTierForCalculator("mortgage")).toBeNull();
    expect(getRequiredTierForCalculator("retirement")).toBe("enterprise");
  });

  test("hasCalculatorAccess: free feature", () => {
    expect(hasCalculatorAccess(null, "mortgage")).toBe(true);
  });

  test("hasCalculatorAccess: gated with sufficient tier", () => {
    expect(hasCalculatorAccess("pro", "investment")).toBe(true);
  });

  test("hasCalculatorAccess: gated with insufficient tier", () => {
    expect(hasCalculatorAccess("basic", "retirement")).toBe(false);
  });

  test("isFeatureFree and hasTierAccess are re-exported", () => {
    expect(isFeatureFree("mortgage")).toBe(true);
    expect(hasTierAccess("pro", "basic")).toBe(true);
  });

  test("getAccessibleCalculators returns list for tier", () => {
    const list = getAccessibleCalculators("enterprise");
    expect(list).toContain("mortgage");
    expect(list).toContain("retirement");
  });
});
