/**
 * Unit tests for observability metrics. METRICS_ENABLED and window are used to gate;
 * in test env METRICS_ENABLED may be false so record* may no-op. We test the API
 * and normalizeRouteLabel/statusClass which are pure.
 */

import { describe, it, expect } from "bun:test";
import {
  normalizeRouteLabel,
  recordHttpRequest,
  recordError,
  recordUnhandledRejection,
  recordUncaughtException,
  recordDbQuery,
  recordConnectionPool,
  recordCompositionEvent,
  recordCompositionLatency,
  setUptimeSeconds,
  getMetricsContent,
  isMetricsEnabled,
  registry,
} from "@/services/observability/metrics";

describe("observability metrics", () => {
  describe("normalizeRouteLabel", () => {
    it("returns path with up to 4 segments", () => {
      expect(normalizeRouteLabel("/api/health")).toBe("/api/health");
      expect(normalizeRouteLabel("/api/v1/users")).toBe("/api/v1/users");
      // 4 segments; numeric 123 becomes :id
      expect(normalizeRouteLabel("/api/v1/users/123/posts")).toBe(
        "/api/v1/users/:id",
      );
    });

    it("replaces UUID segments with :id", () => {
      const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      expect(normalizeRouteLabel(`/api/users/${uuid}`)).toBe("/api/users/:id");
    });

    it("replaces numeric segments with :id", () => {
      expect(normalizeRouteLabel("/api/orders/42")).toBe("/api/orders/:id");
    });

    it("handles root path", () => {
      expect(normalizeRouteLabel("/")).toBe("/");
    });

    it("handles empty segments", () => {
      expect(normalizeRouteLabel("/api///users")).toBe("/api/users");
    });
  });

  describe("recordHttpRequest", () => {
    it("does not throw when called", () => {
      recordHttpRequest("GET", "/api/health", 200, 10);
    });
  });

  describe("recordError", () => {
    it("does not throw when called", () => {
      recordError("validation", "low");
    });
  });

  describe("recordUnhandledRejection", () => {
    it("does not throw when called", () => {
      recordUnhandledRejection();
    });
  });

  describe("recordUncaughtException", () => {
    it("does not throw when called", () => {
      recordUncaughtException();
    });
  });

  describe("recordDbQuery", () => {
    it("does not throw when called", () => {
      recordDbQuery("User", "findMany", 5, "ok");
      recordDbQuery("User", "findMany", 5, "error");
    });
  });

  describe("recordConnectionPool", () => {
    it("does not throw when called", () => {
      recordConnectionPool(2, 8, 10);
    });
  });

  describe("composition metrics", () => {
    it("records composition events and latencies without throwing", () => {
      recordCompositionEvent("save", "ok");
      recordCompositionEvent("render", "validation_failed");
      recordCompositionLatency("validate", 125);
    });
  });

  describe("setUptimeSeconds", () => {
    it("does not throw when called", () => {
      setUptimeSeconds(100);
    });
  });

  describe("getMetricsContent", () => {
    it("returns a string (empty when metrics disabled)", async () => {
      const content = await getMetricsContent();
      expect(typeof content).toBe("string");
    });
  });

  describe("isMetricsEnabled", () => {
    it("returns boolean", () => {
      const result = isMetricsEnabled();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("registry", () => {
    it("is defined", () => {
      expect(registry).toBeDefined();
    });
  });
});
