/**
 * Database performance monitor – getQueryStats, getConnectionStats, getHealthCheck.
 */
import { describe, expect, test } from "bun:test";
import dbPerformanceMonitor from "@/services/db/performance-monitor";

describe("performance-monitor", () => {
  describe("getQueryStats", () => {
    test("returns shape with totalQueries, averageTime, slowQueries, errorQueries, topSlowQueries", () => {
      const stats = dbPerformanceMonitor.getQueryStats(60);
      expect(stats).toHaveProperty("totalQueries");
      expect(stats).toHaveProperty("averageTime");
      expect(stats).toHaveProperty("slowQueries");
      expect(stats).toHaveProperty("errorQueries");
      expect(stats).toHaveProperty("topSlowQueries");
      expect(Array.isArray(stats.topSlowQueries)).toBe(true);
    });

    test("returns zeros when no metrics", () => {
      const stats = dbPerformanceMonitor.getQueryStats(60);
      expect(stats.totalQueries).toBe(0);
      expect(stats.averageTime).toBe(0);
      expect(stats.slowQueries).toBe(0);
      expect(stats.errorQueries).toBe(0);
    });
  });

  describe("getConnectionStats", () => {
    test("returns status and message or connection metrics", () => {
      const stats = dbPerformanceMonitor.getConnectionStats();
      expect(stats).toHaveProperty("status");
      expect(["OK", "NO_DATA"]).toContain(stats.status);
      if (stats.status === "NO_DATA") {
        expect(stats).toHaveProperty("message");
      } else {
        expect(stats).toHaveProperty("totalConnections");
        expect(stats).toHaveProperty("activeConnections");
        expect(stats).toHaveProperty("idleConnections");
        expect(stats).toHaveProperty("lastUpdated");
      }
    });
  });

  describe("getHealthCheck", () => {
    test("returns healthy, timestamp, queries, connections", () => {
      const health = dbPerformanceMonitor.getHealthCheck();
      expect(health).toHaveProperty("healthy");
      expect(health).toHaveProperty("timestamp");
      expect(health).toHaveProperty("queries");
      expect(health).toHaveProperty("connections");
      expect(typeof health.healthy).toBe("boolean");
    });
  });
});
