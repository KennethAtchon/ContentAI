/**
 * Rate limit config – RATE_LIMIT_CONFIGS, getRateLimitConfig, shouldAlertOnExceed, getTPS, etc.
 */
import { describe, expect, test } from "bun:test";
import {
  RATE_LIMIT_CONFIGS,
  getRateLimitConfig,
  getAllRateLimitConfigs,
  getAlertableRateLimitConfigs,
  calculateRemainingRequests,
  shouldAlertOnExceed,
  getTPS,
  getRateLimitSummary,
  type RateLimitType,
} from "@/shared/constants/rate-limit.config";

describe("rate-limit.config", () => {
  describe("RATE_LIMIT_CONFIGS", () => {
    test("has default config", () => {
      expect(RATE_LIMIT_CONFIGS.default).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.default.window).toBe(60);
      expect(RATE_LIMIT_CONFIGS.default.maxRequests).toBe(30);
      expect(RATE_LIMIT_CONFIGS.default.keyPrefix).toBe("default_rate_limit");
    });

    test("has auth config with alert", () => {
      expect(RATE_LIMIT_CONFIGS.auth.maxRequests).toBe(5);
      expect(RATE_LIMIT_CONFIGS.auth.alertOnExceed).toBe(true);
    });

    test("has payment, upload, admin, customer, health, public", () => {
      expect(RATE_LIMIT_CONFIGS.payment).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.upload).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.admin).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.customer).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.health).toBeDefined();
      expect(RATE_LIMIT_CONFIGS.public).toBeDefined();
    });
  });

  describe("getRateLimitConfig", () => {
    test("returns config for known type", () => {
      const config = getRateLimitConfig("auth");
      expect(config.window).toBe(60);
      expect(config.maxRequests).toBe(5);
      expect(config.tps).toBe(5 / 60);
    });

    test("returns default for unknown type", () => {
      const config = getRateLimitConfig("unknown" as RateLimitType);
      expect(config).toEqual(RATE_LIMIT_CONFIGS.default);
    });
  });

  describe("getAllRateLimitConfigs", () => {
    test("returns array with type on each", () => {
      const configs = getAllRateLimitConfigs();
      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(5);
      expect(
        configs.every((c) => "type" in c && c.window && c.maxRequests)
      ).toBe(true);
    });
  });

  describe("getAlertableRateLimitConfigs", () => {
    test("returns only configs with alertOnExceed true", () => {
      const configs = getAlertableRateLimitConfigs();
      expect(configs.every((c) => c.alertOnExceed)).toBe(true);
      expect(configs.some((c) => c.type === "auth")).toBe(true);
    });
  });

  describe("calculateRemainingRequests", () => {
    test("returns max - current when under limit", () => {
      expect(calculateRemainingRequests("default", 10)).toBe(20);
    });
    test("returns 0 when at or over limit", () => {
      expect(calculateRemainingRequests("default", 30)).toBe(0);
      expect(calculateRemainingRequests("default", 40)).toBe(0);
    });
  });

  describe("shouldAlertOnExceed", () => {
    test("auth returns true", () =>
      expect(shouldAlertOnExceed("auth")).toBe(true));
    test("default returns false", () =>
      expect(shouldAlertOnExceed("default")).toBe(false));
  });

  describe("getTPS", () => {
    test("returns maxRequests/window", () => {
      expect(getTPS("default")).toBe(30 / 60);
      expect(getTPS("auth")).toBe(5 / 60);
    });
  });

  describe("getRateLimitSummary", () => {
    test("returns string with header and lines", () => {
      const summary = getRateLimitSummary();
      expect(summary).toContain("Rate Limit Configuration Summary");
      expect(summary).toContain("default");
      expect(summary).toContain("auth");
    });
  });
});
