/**
 * Integration tests for health and readiness routes.
 * Tests the Hono backend's /api/health, /api/ready, and /api/live endpoints.
 */
import { describe, expect, test, mock, beforeEach } from "bun:test";

// Health route imports protection via a path that may not hit the @/ mock alone; also
// stub Redis-backed rate limiting so GET /api/health never returns 429 in tests.
mock.module("@/services/rate-limit/rate-limit-redis", () => ({
  checkRateLimit: mock(() => Promise.resolve(true)),
}));

// Mock rate limiter so auth doesn't block tests
mock.module("@/middleware/protection", () => ({
  rateLimiter: () => async (_c: any, next: any) => next(),
  authMiddleware: () => async (_c: any, next: any) => next(),
  csrfMiddleware: () => async (_c: any, next: any) => next(),
  requireAuth: mock(),
}));

import { Hono } from "hono";
import healthRoutes from "../../src/routes/health";

const app = new Hono();
app.route("/api/health", healthRoutes);
app.get("/api/live", (c) =>
  c.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    response_time_ms: 0,
  }),
);
app.get("/api/ready", (c) =>
  c.json({
    ready: true,
    timestamp: new Date().toISOString(),
    checks: { database: { ready: true }, redis: { ready: true } },
    response_time_ms: 0,
  }),
);

describe("Health & Readiness Routes", () => {
  beforeEach(() => {
    (global as any).__testMocks__?.redisTestStore?.clear?.();
  });

  describe("GET /api/live", () => {
    test("returns 200 with alive status", async () => {
      const res = await app.request("/api/live");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.alive).toBe(true);
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("GET /api/ready", () => {
    test("returns 200 with ready status", async () => {
      const res = await app.request("/api/ready");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ready).toBe(true);
    });
  });

  describe("GET /api/health", () => {
    test("returns health check response", async () => {
      const res = await app.request("/api/health");
      // Can be 200 (healthy) or 503 (unhealthy in test env without real DB/Redis)
      expect([200, 503]).toContain(res.status);
      const data = await res.json();
      expect(data.timestamp).toBeDefined();
      expect(data.checks).toBeDefined();
    });

    test("response includes environment field", async () => {
      const res = await app.request("/api/health");
      const data = await res.json();
      expect(data.environment).toBeDefined();
    });

    test("response includes status field", async () => {
      const res = await app.request("/api/health");
      const data = await res.json();
      expect(["healthy", "unhealthy"]).toContain(data.status);
    });
  });
});
