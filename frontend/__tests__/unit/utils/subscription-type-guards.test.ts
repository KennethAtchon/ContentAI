/**
 * Unit tests for subscription type guards
 */
import { describe, expect, test } from "bun:test";
import {
  isSubscriptionTier,
  toSubscriptionTier,
  assertSubscriptionTier,
} from "@/shared/type-guards/subscription-type-guards";

describe("subscription type guards", () => {
  describe("isSubscriptionTier", () => {
    test("should return true for valid tier strings", () => {
      expect(isSubscriptionTier("basic")).toBe(true);
      expect(isSubscriptionTier("pro")).toBe(true);
      expect(isSubscriptionTier("enterprise")).toBe(true);
    });

    test("should return false for non-strings", () => {
      expect(isSubscriptionTier(123)).toBe(false);
      expect(isSubscriptionTier(null)).toBe(false);
      expect(isSubscriptionTier(undefined)).toBe(false);
      expect(isSubscriptionTier({})).toBe(false);
    });

    test("should return false for invalid strings", () => {
      expect(isSubscriptionTier("free")).toBe(false);
      expect(isSubscriptionTier("")).toBe(false);
      expect(isSubscriptionTier("Basic")).toBe(false);
    });
  });

  describe("toSubscriptionTier", () => {
    test("should return tier for valid value", () => {
      expect(toSubscriptionTier("basic")).toBe("basic");
      expect(toSubscriptionTier("pro")).toBe("pro");
    });

    test("should return null for invalid value", () => {
      expect(toSubscriptionTier("invalid")).toBeNull();
      expect(toSubscriptionTier(42)).toBeNull();
    });
  });

  describe("assertSubscriptionTier", () => {
    test("should return value when valid", () => {
      expect(assertSubscriptionTier("enterprise")).toBe("enterprise");
    });

    test("should throw with default context when invalid", () => {
      expect(() => assertSubscriptionTier("invalid")).toThrow(
        /Invalid subscription tier validation/
      );
    });

    test("should throw with custom context when invalid", () => {
      expect(() => assertSubscriptionTier(null, "request body tier")).toThrow(
        /Invalid request body tier/
      );
    });

    test("should include expected values in error message", () => {
      expect(() => assertSubscriptionTier("x")).toThrow(
        /basic.*pro.*enterprise/
      );
    });
  });
});
