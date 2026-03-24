/**
 * Stripe map loader – getStripeMap, getStripeTierConfig, getStripePriceId, getStripePriceAmount.
 */
import { describe, expect, test } from "bun:test";
import {
  getStripeMap,
  getStripeTierConfig,
  getStripePriceId,
  getStripePriceAmount,
} from "@/shared/utils/stripe-map-loader";

describe("stripe-map-loader", () => {
  describe("getStripeMap", () => {
    test("returns map with tiers", () => {
      const map = getStripeMap();
      expect(map).toBeDefined();
      expect(map.tiers).toBeDefined();
      expect(map.tiers.basic).toBeDefined();
      expect(map.tiers.pro).toBeDefined();
      expect(map.tiers.enterprise).toBeDefined();
    });
  });

  describe("getStripeTierConfig", () => {
    test("returns config for basic tier", () => {
      const config = getStripeTierConfig("basic");
      expect(config.productId).toBeDefined();
      expect(config.productName).toBeDefined();
      expect(config.prices.monthly).toBeDefined();
      expect(config.prices.annual).toBeDefined();
    });

    test("returns config for pro tier", () => {
      const config = getStripeTierConfig("pro");
      expect(config.prices.monthly.priceId).toBeDefined();
      expect(config.prices.annual.amount).toBe(490);
    });

    test("returns config for enterprise tier", () => {
      const config = getStripeTierConfig("enterprise");
      expect(config.prices.monthly.amount).toBe(149);
      expect(config.prices.annual.amount).toBe(1490);
    });
  });

  describe("getStripePriceId", () => {
    test("returns monthly price ID for basic", () => {
      const id = getStripePriceId("basic", "monthly");
      expect(id).toBeTruthy();
      expect(id.startsWith("price_")).toBe(true);
    });

    test("returns annual price ID for pro", () => {
      const id = getStripePriceId("pro", "annual");
      expect(id).toBeTruthy();
    });
  });

  describe("getStripePriceAmount", () => {
    test("returns monthly amount for basic", () => {
      const amount = getStripePriceAmount("basic", "monthly");
      expect(amount).toBe(19);
    });

    test("returns annual amount for basic", () => {
      const amount = getStripePriceAmount("basic", "annual");
      expect(amount).toBe(190);
    });

    test("returns correct amounts for enterprise", () => {
      expect(getStripePriceAmount("enterprise", "monthly")).toBe(149);
      expect(getStripePriceAmount("enterprise", "annual")).toBe(1490);
    });
  });
});
