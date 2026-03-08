/**
 * Unit tests for subscription type guards
 */
import { describe, expect, test } from "bun:test";
import {
  isSubscriptionType,
  isValidSubscriptionStatus,
} from "@/utils/type-guards/subscription-type-guards";

describe("subscription type guards", () => {
  describe("isSubscriptionType", () => {
    test("returns true for valid tier strings", () => {
      expect(isSubscriptionType("basic")).toBe(true);
      expect(isSubscriptionType("pro")).toBe(true);
      expect(isSubscriptionType("enterprise")).toBe(true);
    });

    test("returns false for invalid strings", () => {
      expect(isSubscriptionType("free")).toBe(false);
      expect(isSubscriptionType("")).toBe(false);
      expect(isSubscriptionType("Basic")).toBe(false);
      expect(isSubscriptionType("invalid")).toBe(false);
    });
  });

  describe("isValidSubscriptionStatus", () => {
    test("returns true for valid statuses", () => {
      expect(isValidSubscriptionStatus("active")).toBe(true);
      expect(isValidSubscriptionStatus("canceled")).toBe(true);
      expect(isValidSubscriptionStatus("past_due")).toBe(true);
      expect(isValidSubscriptionStatus("trialing")).toBe(true);
    });

    test("returns false for invalid statuses", () => {
      expect(isValidSubscriptionStatus("expired")).toBe(false);
      expect(isValidSubscriptionStatus("")).toBe(false);
      expect(isValidSubscriptionStatus("Active")).toBe(false);
    });
  });
});
