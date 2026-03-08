/**
 * Unit tests for query-keys: key builders for React Query cache.
 */

import { describe, it, expect } from "bun:test";
import { queryKeys } from "@/shared/lib/query-keys";

describe("query-keys", () => {
  describe("api", () => {
    it("profile returns stable key", () => {
      expect(queryKeys.api.profile()).toEqual(["api", "customer", "profile"]);
    });

    it("calculatorUsage returns stable key", () => {
      expect(queryKeys.api.calculatorUsage()).toEqual([
        "api",
        "calculator",
        "usage",
      ]);
    });

    it("calculatorHistory with no params", () => {
      expect(queryKeys.api.calculatorHistory()).toEqual([
        "api",
        "calculator",
        "history",
        undefined,
      ]);
    });

    it("calculatorHistory with params", () => {
      expect(queryKeys.api.calculatorHistory({ page: 1, limit: 10 })).toEqual([
        "api",
        "calculator",
        "history",
        { page: 1, limit: 10 },
      ]);
    });

    it("trialEligibility", () => {
      expect(queryKeys.api.trialEligibility()).toEqual([
        "api",
        "subscriptions",
        "trial-eligibility",
      ]);
    });

    it("currentSubscription", () => {
      expect(queryKeys.api.currentSubscription()).toEqual([
        "api",
        "subscriptions",
        "current",
      ]);
    });

    it("portalLink", () => {
      expect(queryKeys.api.portalLink()).toEqual([
        "api",
        "subscriptions",
        "portal-link",
      ]);
    });

    it("usageStats", () => {
      expect(queryKeys.api.usageStats()).toEqual(["api", "account", "usage"]);
    });

    it("paginated", () => {
      expect(queryKeys.api.paginated("orders", { page: 1, limit: 20 })).toEqual(
        ["api", "paginated", "orders", { page: 1, limit: 20 }]
      );
    });
  });

  describe("api.admin", () => {
    it("orders", () => {
      expect(queryKeys.api.admin.orders()).toEqual([
        "api",
        "admin",
        "orders",
        undefined,
      ]);
      expect(queryKeys.api.admin.orders({ page: 2, limit: 15 })).toEqual([
        "api",
        "admin",
        "orders",
        { page: 2, limit: 15 },
      ]);
    });

    it("users", () => {
      expect(queryKeys.api.admin.users()).toEqual(["api", "admin", "users"]);
    });

    it("customers", () => {
      expect(queryKeys.api.admin.customers()).toEqual([
        "api",
        "admin",
        "customers",
        undefined,
      ]);
    });

    it("dashboard", () => {
      expect(queryKeys.api.admin.dashboard()).toEqual([
        "api",
        "admin",
        "dashboard",
      ]);
    });

    it("customersCount", () => {
      expect(queryKeys.api.admin.customersCount()).toEqual([
        "api",
        "users",
        "customers-count",
      ]);
    });

    it("conversion", () => {
      expect(queryKeys.api.admin.conversion()).toEqual([
        "api",
        "admin",
        "analytics",
      ]);
    });

    it("revenue", () => {
      expect(queryKeys.api.admin.revenue()).toEqual([
        "api",
        "customer",
        "orders",
        "total-revenue",
      ]);
    });

    it("subscriptionsAnalytics", () => {
      expect(queryKeys.api.admin.subscriptionsAnalytics()).toEqual([
        "api",
        "admin",
        "subscriptions",
        "analytics",
      ]);
    });

    it("subscriptions", () => {
      expect(queryKeys.api.admin.subscriptions()).toEqual([
        "api",
        "admin",
        "subscriptions",
      ]);
    });

    it("subscriptionStats", () => {
      expect(queryKeys.api.admin.subscriptionStats()).toEqual([
        "api",
        "admin",
        "subscriptions",
        "stats",
      ]);
    });

    it("subscriptionAnalytics", () => {
      expect(queryKeys.api.admin.subscriptionsAnalytics()).toEqual([
        "api",
        "admin",
        "subscriptions",
        "analytics",
      ]);
    });

    it("contactMessages", () => {
      expect(queryKeys.api.admin.contactMessages()).toEqual([
        "api",
        "shared",
        "contact-messages",
        undefined,
      ]);
      expect(
        queryKeys.api.admin.contactMessages({ page: 1, limit: 25 })
      ).toEqual(["api", "shared", "contact-messages", { page: 1, limit: 25 }]);
    });
  });
});
