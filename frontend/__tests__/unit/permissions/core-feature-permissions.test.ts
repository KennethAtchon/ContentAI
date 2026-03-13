import { describe, expect, test } from "bun:test";
import {
  getRequiredTierForFeature,
  isFeatureFree,
  hasFeatureAccess,
  hasTierAccess,
  getAccessibleFeatures,
  FEATURE_TIER_REQUIREMENTS,
} from "@/shared/utils/permissions/core-feature-permissions";

describe("core-feature-permissions", () => {
  describe("getRequiredTierForFeature", () => {
    test("studio is free (null)", () => {
      expect(getRequiredTierForFeature("studio")).toBeNull();
    });
    test("publishing requires pro", () => {
      expect(getRequiredTierForFeature("publishing")).toBe("pro");
    });
  });

  describe("isFeatureFree", () => {
    test("studio is free", () => {
      expect(isFeatureFree("studio")).toBe(true);
    });
    test("publishing is not free", () => {
      expect(isFeatureFree("publishing")).toBe(false);
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
      expect(hasFeatureAccess(null, "studio")).toBe(true);
      expect(hasFeatureAccess(undefined, "studio")).toBe(true);
      expect(hasFeatureAccess("basic", "studio")).toBe(true);
    });
    test("gated feature: null tier no access", () => {
      expect(hasFeatureAccess(null, "publishing")).toBe(false);
    });
    test("gated feature: tier meets requirement", () => {
      expect(hasFeatureAccess("pro", "publishing")).toBe(true);
      expect(hasFeatureAccess("enterprise", "publishing")).toBe(true);
    });
    test("gated feature: tier below requirement", () => {
      expect(hasFeatureAccess("basic", "publishing")).toBe(false);
    });
  });

  describe("getAccessibleFeatures", () => {
    test("null tier returns only free features", () => {
      const features = getAccessibleFeatures(null);
      expect(features).toContain("studio");
      expect(features).not.toContain("publishing");
    });
    test("basic tier includes studio and generation but not publishing", () => {
      const features = getAccessibleFeatures("basic");
      expect(features).toContain("studio");
      expect(features).not.toContain("publishing");
    });
    test("enterprise tier includes all", () => {
      const features = getAccessibleFeatures("enterprise");
      expect(features).toContain("studio");
      expect(features).toContain("publishing");
    });
  });

  describe("FEATURE_TIER_REQUIREMENTS", () => {
    test("has entries for all features", () => {
      expect(FEATURE_TIER_REQUIREMENTS.studio).toBeNull();
      expect(FEATURE_TIER_REQUIREMENTS.generation).toBeNull();
      expect(FEATURE_TIER_REQUIREMENTS.queue).toBeNull();
      expect(FEATURE_TIER_REQUIREMENTS.publishing).toBe("pro");
    });
  });
});
