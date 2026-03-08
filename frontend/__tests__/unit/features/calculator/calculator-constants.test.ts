/**
 * Unit tests for calculator constants and getters.
 * Icons from lucide-react are tested as "defined".
 */

import { describe, it, expect } from "bun:test";
import {
  CALCULATOR_CONFIG,
  VALID_CALCULATION_TYPES,
  CALCULATOR_TIER_REQUIREMENTS,
  getCalculatorConfig,
  getAllCalculatorConfigs,
  getCalculatorName,
  getCalculatorShortName,
  getCalculatorDescription,
  getCalculatorIcon,
  getCalculatorTierRequirement,
  getCalculatorsForTier,
  isCalculatorFree,
} from "@/features/calculator/constants/calculator.constants";
import type { CalculationType } from "@/features/calculator/constants/calculator.constants";

describe("calculator constants", () => {
  describe("CALCULATOR_CONFIG", () => {
    it("has mortgage, loan, investment, retirement", () => {
      expect(CALCULATOR_CONFIG.mortgage).toBeDefined();
      expect(CALCULATOR_CONFIG.loan).toBeDefined();
      expect(CALCULATOR_CONFIG.investment).toBeDefined();
      expect(CALCULATOR_CONFIG.retirement).toBeDefined();
    });

    it("mortgage has tierRequirement null (free)", () => {
      expect(CALCULATOR_CONFIG.mortgage.tierRequirement).toBeNull();
    });

    it("loan requires basic", () => {
      expect(CALCULATOR_CONFIG.loan.tierRequirement).toBe("basic");
    });

    it("investment requires pro", () => {
      expect(CALCULATOR_CONFIG.investment.tierRequirement).toBe("pro");
    });

    it("retirement requires enterprise", () => {
      expect(CALCULATOR_CONFIG.retirement.tierRequirement).toBe("enterprise");
    });
  });

  describe("VALID_CALCULATION_TYPES", () => {
    it("includes all four types", () => {
      expect(VALID_CALCULATION_TYPES).toContain("mortgage");
      expect(VALID_CALCULATION_TYPES).toContain("loan");
      expect(VALID_CALCULATION_TYPES).toContain("investment");
      expect(VALID_CALCULATION_TYPES).toContain("retirement");
      expect(VALID_CALCULATION_TYPES).toHaveLength(4);
    });
  });

  describe("CALCULATOR_TIER_REQUIREMENTS", () => {
    it("maps each type to tier or null", () => {
      expect(CALCULATOR_TIER_REQUIREMENTS.mortgage).toBeNull();
      expect(CALCULATOR_TIER_REQUIREMENTS.loan).toBe("basic");
      expect(CALCULATOR_TIER_REQUIREMENTS.retirement).toBe("enterprise");
    });
  });

  describe("getCalculatorConfig", () => {
    it("returns config for valid type", () => {
      const config = getCalculatorConfig("mortgage");
      expect(config.id).toBe("mortgage");
      expect(config.name).toBe("Mortgage Calculator");
      expect(config.displayOrder).toBe(1);
    });
  });

  describe("getAllCalculatorConfigs", () => {
    it("returns configs sorted by displayOrder", () => {
      const configs = getAllCalculatorConfigs();
      expect(configs).toHaveLength(4);
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].displayOrder).toBeGreaterThanOrEqual(
          configs[i - 1].displayOrder
        );
      }
    });
  });

  describe("getCalculatorName", () => {
    it("returns name for each type", () => {
      expect(getCalculatorName("mortgage")).toBe("Mortgage Calculator");
      expect(getCalculatorName("loan")).toBe("Loan Calculator");
    });
  });

  describe("getCalculatorShortName", () => {
    it("returns shortName for valid type", () => {
      expect(getCalculatorShortName("mortgage")).toBe("Mortgage");
      expect(getCalculatorShortName("retirement")).toBe("Retirement");
    });

    it("returns type string for unknown key when config missing", () => {
      const out = getCalculatorShortName("invalid" as CalculationType);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    });
  });

  describe("getCalculatorDescription", () => {
    it("returns description string", () => {
      expect(getCalculatorDescription("investment")).toContain("compound");
    });
  });

  describe("getCalculatorIcon", () => {
    it("returns icon (LucideIcon) for each type", () => {
      expect(getCalculatorIcon("mortgage")).toBeDefined();
      expect(getCalculatorIcon("loan")).toBeDefined();
    });
  });

  describe("getCalculatorTierRequirement", () => {
    it("returns tier or null", () => {
      expect(getCalculatorTierRequirement("mortgage")).toBeNull();
      expect(getCalculatorTierRequirement("loan")).toBe("basic");
      expect(getCalculatorTierRequirement("retirement")).toBe("enterprise");
    });
  });

  describe("getCalculatorsForTier", () => {
    it("basic tier includes mortgage and loan", () => {
      const list = getCalculatorsForTier("basic");
      expect(list).toContain("mortgage");
      expect(list).toContain("loan");
      expect(list).not.toContain("investment");
    });

    it("pro tier includes mortgage, loan, investment", () => {
      const list = getCalculatorsForTier("pro");
      expect(list).toContain("mortgage");
      expect(list).toContain("loan");
      expect(list).toContain("investment");
      expect(list).not.toContain("retirement");
    });

    it("enterprise tier includes all", () => {
      const list = getCalculatorsForTier("enterprise");
      expect(list).toContain("mortgage");
      expect(list).toContain("loan");
      expect(list).toContain("investment");
      expect(list).toContain("retirement");
    });
  });

  describe("isCalculatorFree", () => {
    it("mortgage is free", () => {
      expect(isCalculatorFree("mortgage")).toBe(true);
    });

    it("loan is not free", () => {
      expect(isCalculatorFree("loan")).toBe(false);
    });
  });
});
