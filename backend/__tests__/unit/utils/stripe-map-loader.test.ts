/**
 * Stripe map loader – loadStripePriceMap, getStripePriceId, getStripePriceAmount.
 */
import { describe, expect, test } from "bun:test";
import {
  loadStripePriceMap,
  getStripePriceId,
  getStripePriceAmount,
} from "@/utils/stripe-map-loader";

describe("stripe-map-loader", () => {
  describe("loadStripePriceMap", () => {
    test("returns map with tier price IDs", () => {
      const map = loadStripePriceMap();
      expect(map).toBeDefined();
      expect(map.basic).toBeDefined();
      expect(map.pro).toBeDefined();
      expect(map.enterprise).toBeDefined();
    });
  });

  describe("getStripePriceId", () => {
    test("returns price ID for basic tier", () => {
      const id = getStripePriceId("basic");
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    test("returns price ID for pro tier", () => {
      const id = getStripePriceId("pro");
      expect(typeof id).toBe("string");
    });

    test("returns price ID for enterprise tier", () => {
      const id = getStripePriceId("enterprise");
      expect(typeof id).toBe("string");
    });

    test("returns fallback for unknown tier", () => {
      const id = getStripePriceId("unknown");
      expect(typeof id).toBe("string");
    });
  });

  describe("getStripePriceAmount", () => {
    test("returns positive number for basic", () => {
      const amount = getStripePriceAmount("basic");
      expect(amount).toBeGreaterThan(0);
    });

    test("returns positive number for pro", () => {
      const amount = getStripePriceAmount("pro");
      expect(amount).toBeGreaterThan(0);
    });

    test("returns positive number for enterprise", () => {
      const amount = getStripePriceAmount("enterprise");
      expect(amount).toBeGreaterThan(0);
    });

    test("pro costs more than basic", () => {
      expect(getStripePriceAmount("pro")).toBeGreaterThan(
        getStripePriceAmount("basic"),
      );
    });

    test("returns fallback for unknown tier", () => {
      const amount = getStripePriceAmount("unknown");
      expect(amount).toBeGreaterThan(0);
    });
  });
});
