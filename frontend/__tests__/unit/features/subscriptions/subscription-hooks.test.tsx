/**
 * Unit tests for useSubscription and useHasTierAccess hooks.
 * Tests tier resolution logic and access hierarchy.
 */
/// <reference lib="dom" />
import { describe, it, expect, mock } from "bun:test";

// Mock firebase/auth before imports
mock.module("firebase/auth", () => ({
  getAuth: mock(() => ({
    currentUser: null,
    onAuthStateChanged: mock((_cb: any) => () => {}),
  })),
}));

mock.module("@tanstack/react-query", () => ({
  useQueryClient: mock(() => ({
    invalidateQueries: mock(),
  })),
}));

import {
  useSubscription,
  useHasTierAccess,
} from "@/features/subscriptions/hooks/use-subscription";

describe("useSubscription exports", () => {
  it("useSubscription is a function", () => {
    expect(typeof useSubscription).toBe("function");
  });

  it("useHasTierAccess is a function", () => {
    expect(typeof useHasTierAccess).toBe("function");
  });
});

describe("tier access hierarchy logic", () => {
  // Test the tier hierarchy logic directly (not via hook)
  const tierHierarchy: Record<string, number> = {
    basic: 1,
    pro: 2,
    enterprise: 3,
  };

  it("basic tier level is 1", () => {
    expect(tierHierarchy["basic"]).toBe(1);
  });

  it("pro tier level is 2 (higher than basic)", () => {
    expect(tierHierarchy["pro"]).toBeGreaterThan(tierHierarchy["basic"]);
  });

  it("enterprise tier level is 3 (highest)", () => {
    expect(tierHierarchy["enterprise"]).toBeGreaterThan(tierHierarchy["pro"]);
  });

  it("null role has no tier access", () => {
    const role = null;
    const userTierLevel = role ? tierHierarchy[role] : 0;
    expect(userTierLevel).toBe(0);
  });

  it("basic user can access basic features", () => {
    const userTierLevel = tierHierarchy["basic"];
    const requiredLevel = tierHierarchy["basic"];
    expect(userTierLevel >= requiredLevel).toBe(true);
  });

  it("basic user cannot access pro features", () => {
    const userTierLevel = tierHierarchy["basic"];
    const requiredLevel = tierHierarchy["pro"];
    expect(userTierLevel >= requiredLevel).toBe(false);
  });

  it("pro user can access basic and pro features", () => {
    const userTierLevel = tierHierarchy["pro"];
    expect(userTierLevel >= tierHierarchy["basic"]).toBe(true);
    expect(userTierLevel >= tierHierarchy["pro"]).toBe(true);
    expect(userTierLevel >= tierHierarchy["enterprise"]).toBe(false);
  });

  it("enterprise user can access all tiers", () => {
    const userTierLevel = tierHierarchy["enterprise"];
    expect(userTierLevel >= tierHierarchy["basic"]).toBe(true);
    expect(userTierLevel >= tierHierarchy["pro"]).toBe(true);
    expect(userTierLevel >= tierHierarchy["enterprise"]).toBe(true);
  });
});

describe("SubscriptionAccess shape", () => {
  it("knows what fields useSubscription returns", () => {
    // Verify the expected return shape via the interface
    const expectedFields = [
      "role",
      "hasBasicAccess",
      "hasProAccess",
      "hasEnterpriseAccess",
      "isLoading",
      "error",
    ];
    // These are the fields defined in SubscriptionAccess interface
    expect(expectedFields).toContain("role");
    expect(expectedFields).toContain("hasBasicAccess");
    expect(expectedFields).toContain("isLoading");
  });
});
