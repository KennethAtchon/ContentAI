/**
 * Unit tests for subscription.constants – getTierConfig, tierHasExportFormat,
 * isUsageLimitReached, getTierDescription.
 */
import { describe, expect, test } from "bun:test";
import {
  SUBSCRIPTION_TIERS,
  getTierConfig,
  tierHasExportFormat,
  isUsageLimitReached,
  getTierDescription,
  type SubscriptionTier,
} from "@/constants/subscription.constants";

describe("subscription.constants", () => {
  describe("getTierConfig", () => {
    test("returns config for basic monthly", () => {
      const config = getTierConfig(SUBSCRIPTION_TIERS.BASIC, "monthly");
      expect(config.name).toBe("Basic");
      expect(config.billingCycle).toBe("monthly");
      expect(config.features.calculationTypes).toContain("loan");
      expect(config.stripePriceId).toBeDefined();
      expect(typeof config.price).toBe("number");
    });

    test("returns config for pro annual", () => {
      const config = getTierConfig(SUBSCRIPTION_TIERS.PRO, "annual");
      expect(config.name).toBe("Pro");
      expect(config.billingCycle).toBe("annual");
      expect(config.features.exportFormats).toContain("pdf");
    });

    test("defaults billing cycle to monthly", () => {
      const config = getTierConfig(SUBSCRIPTION_TIERS.ENTERPRISE);
      expect(config.billingCycle).toBe("monthly");
    });
  });

  describe("tierHasExportFormat", () => {
    test("returns true when tier has format", () => {
      expect(tierHasExportFormat(SUBSCRIPTION_TIERS.PRO, "pdf")).toBe(true);
      expect(tierHasExportFormat(SUBSCRIPTION_TIERS.ENTERPRISE, "api")).toBe(
        true,
      );
    });

    test("returns false when tier does not have format", () => {
      expect(tierHasExportFormat(SUBSCRIPTION_TIERS.BASIC, "excel")).toBe(
        false,
      );
    });
  });

  describe("isUsageLimitReached", () => {
    test("returns false when usageLimit is null or -1", () => {
      expect(isUsageLimitReached(100, null)).toBe(false);
      expect(isUsageLimitReached(1000, -1)).toBe(false);
    });

    test("returns false when usage under limit", () => {
      expect(isUsageLimitReached(10, 50)).toBe(false);
    });

    test("returns true when usage at or over limit", () => {
      expect(isUsageLimitReached(50, 50)).toBe(true);
      expect(isUsageLimitReached(51, 50)).toBe(true);
    });
  });

  describe("getTierDescription", () => {
    test("returns descriptions for each tier", () => {
      expect(getTierDescription(SUBSCRIPTION_TIERS.BASIC)).toBe(
        "Basic and higher",
      );
      expect(getTierDescription(SUBSCRIPTION_TIERS.PRO)).toBe(
        "Pro and Enterprise",
      );
      expect(getTierDescription(SUBSCRIPTION_TIERS.ENTERPRISE)).toBe(
        "Enterprise",
      );
    });

    test("returns empty string for unknown tier", () => {
      expect(getTierDescription("unknown" as SubscriptionTier)).toBe("");
    });
  });
});
