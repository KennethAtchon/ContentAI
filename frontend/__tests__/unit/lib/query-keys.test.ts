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

    it("reelsUsage returns stable key", () => {
      expect(queryKeys.api.reelsUsage()).toEqual(["api", "reels", "usage"]);
    });

    it("reelsHistory with no params", () => {
      expect(queryKeys.api.reelsHistory()).toEqual([
        "api",
        "reels",
        "history",
        undefined,
      ]);
    });

    it("reelsHistory with params", () => {
      expect(queryKeys.api.reelsHistory({ page: 1, limit: 10 })).toEqual([
        "api",
        "reels",
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

    it("usersQueriesRoot", () => {
      expect(queryKeys.api.usersQueriesRoot()).toEqual(["api", "users"]);
    });

    it("queueRoot", () => {
      expect(queryKeys.api.queueRoot()).toEqual(["api", "queue"]);
    });

    it("generationHistoryRoot", () => {
      expect(queryKeys.api.generationHistoryRoot()).toEqual([
        "api",
        "generation-history",
      ]);
    });

    it("chatSessionsRoot and chatSession", () => {
      expect(queryKeys.api.chatSessionsRoot()).toEqual(["chat-sessions"]);
      expect(queryKeys.api.chatSession("s1")).toEqual(["chat-sessions", "s1"]);
    });

    it("project", () => {
      expect(queryKeys.api.project("p1")).toEqual(["api", "projects", "p1"]);
    });

    it("contentAssetsPrefix", () => {
      expect(queryKeys.api.contentAssetsPrefix(42)).toEqual([
        "api",
        "assets",
        42,
      ]);
    });

    it("paginated", () => {
      expect(queryKeys.api.paginated("orders", { page: 1, limit: 20 })).toEqual(
        ["api", "paginated", "orders", { page: 1, limit: 20 }]
      );
    });
  });

  describe("api.admin", () => {
    it("ordersRoot", () => {
      expect(queryKeys.api.admin.ordersRoot()).toEqual([
        "api",
        "admin",
        "orders",
      ]);
    });

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

    it("nichesRoot and nicheReelsPrefix and musicRoot", () => {
      expect(queryKeys.api.admin.nichesRoot()).toEqual([
        "api",
        "admin",
        "niches",
      ]);
      expect(queryKeys.api.admin.nicheReelsPrefix(7)).toEqual([
        "api",
        "admin",
        "niche-reels",
        7,
      ]);
      expect(queryKeys.api.admin.musicRoot()).toEqual([
        "api",
        "admin",
        "music",
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
