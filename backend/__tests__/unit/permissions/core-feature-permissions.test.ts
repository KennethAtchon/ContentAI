/**
 * Core feature permissions – tier requirements, hasFeatureAccess, hasTierAccess, getAccessibleFeatures.
 */
import { describe, expect, test } from "bun:test";
import {
  getRequiredTierForFeature,
  isFeatureFree,
  hasFeatureAccess,
  hasTierAccess,
  getAccessibleFeatures,
  FEATURE_TIER_REQUIREMENTS,
} from "@/utils/permissions/core-feature-permissions";

describe("core-feature-permissions", () => {
  describe("getRequiredTierForFeature", () => {
    test("mortgage is free (null)", () => {
      expect(getRequiredTierForFeature("mortgage")).toBeNull();
    });
    test("loan requires basic", () => {
      expect(getRequiredTierForFeature("loan")).toBe("basic");
    });
    test("investment requires pro", () => {
      expect(getRequiredTierForFeature("investment")).toBe("pro");
    });
    test("retirement requires enterprise", () => {
      expect(getRequiredTierForFeature("retirement")).toBe("enterprise");
    });
  });

  describe("isFeatureFree", () => {
    test("mortgage is free", () => {
      expect(isFeatureFree("mortgage")).toBe(true);
    });
    test("loan is not free", () => {
      expect(isFeatureFree("loan")).toBe(false);
    });
  });

  describe("hasTierAccess", () => {
    test("null/undefined tier has no access", () => {
      expect(hasTierAccess(null, "basic")).toBe(false);
      expect(hasTierAccess(undefined, "basic")).toBe(false);
    });
    test("basic meets basic", () => {
      expect(hasTierAccess("basic", "basic")).toBe(true);
    });
    test("pro meets basic", () => {
      expect(hasTierAccess("pro", "basic")).toBe(true);
    });
    test("enterprise meets pro", () => {
      expect(hasTierAccess("enterprise", "pro")).toBe(true);
    });
    test("basic does not meet pro", () => {
      expect(hasTierAccess("basic", "pro")).toBe(false);
    });
    test("pro does not meet enterprise", () => {
      expect(hasTierAccess("pro", "enterprise")).toBe(false);
    });
  });

  describe("hasFeatureAccess", () => {
    test("free feature: no tier required", () => {
      expect(hasFeatureAccess(null, "mortgage")).toBe(true);
      expect(hasFeatureAccess(undefined, "mortgage")).toBe(true);
      expect(hasFeatureAccess("basic", "mortgage")).toBe(true);
    });
    test("gated feature: null tier no access", () => {
      expect(hasFeatureAccess(null, "loan")).toBe(false);
    });
    test("gated feature: tier meets requirement", () => {
      expect(hasFeatureAccess("basic", "loan")).toBe(true);
      expect(hasFeatureAccess("pro", "investment")).toBe(true);
      expect(hasFeatureAccess("enterprise", "retirement")).toBe(true);
    });
    test("gated feature: tier below requirement", () => {
      expect(hasFeatureAccess("basic", "investment")).toBe(false);
      expect(hasFeatureAccess("pro", "retirement")).toBe(false);
    });
  });

  describe("getAccessibleFeatures", () => {
    test("null tier returns only free features", () => {
      const features = getAccessibleFeatures(null);
      expect(features).toContain("mortgage");
      expect(features).not.toContain("loan");
    });
    test("basic tier includes mortgage and loan", () => {
      const features = getAccessibleFeatures("basic");
      expect(features).toContain("mortgage");
      expect(features).toContain("loan");
    });
    test("enterprise tier includes all", () => {
      const features = getAccessibleFeatures("enterprise");
      expect(features).toContain("mortgage");
      expect(features).toContain("loan");
      expect(features).toContain("investment");
      expect(features).toContain("retirement");
    });
  });

  describe("FEATURE_TIER_REQUIREMENTS", () => {
    test("has entries for all calculator types", () => {
      expect(FEATURE_TIER_REQUIREMENTS.mortgage).toBeNull();
      expect(FEATURE_TIER_REQUIREMENTS.loan).toBe("basic");
      expect(FEATURE_TIER_REQUIREMENTS.investment).toBe("pro");
      expect(FEATURE_TIER_REQUIREMENTS.retirement).toBe("enterprise");
    });
  });
});
