/**
 * Unit tests for /api/health route.
 * Verifies response structure, status field, and error monitoring endpoint.
 */
import { describe, it, expect, mock } from "bun:test";

// Mock rate-limit-redis to always allow (dynamic import in rateLimiter middleware)
mock.module("@/services/rate-limit/rate-limit-redis", () => ({
  checkRateLimit: mock(() =>
    Promise.resolve({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: 0,
      retryAfter: 0,
    }),
  ),
}));

const redisMock = {
  ping: mock(() => Promise.resolve("PONG")),
  set: mock(() => Promise.resolve("OK")),
  get: mock(() => Promise.resolve("ok")),
  del: mock(() => Promise.resolve(1)),
};
mock.module("ioredis", () => ({
  default: class MockRedis {
    ping = redisMock.ping;
    set = redisMock.set;
    get = redisMock.get;
    del = redisMock.del;
  },
}));
mock.module("@/services/db/redis", () => ({
  default: () => redisMock,
  getRedisConnection: () => redisMock,
}));

import { Hono } from "hono";
import healthRoutes from "@/routes/health";

const app = new Hono();
app.route("/api/health", healthRoutes);

describe("GET /api/health", () => {
  it("responds with 200 or 503", async () => {
    const res = await app.request("/api/health");
    expect([200, 503]).toContain(res.status);
  });

  it("includes status field of healthy or unhealthy", async () => {
    const res = await app.request("/api/health");
    const data = await res.json();
    expect(["healthy", "unhealthy"]).toContain(data.status);
  });

  it("includes timestamp in response", async () => {
    const res = await app.request("/api/health");
    const data = await res.json();
    expect(typeof data.timestamp).toBe("string");
  });

  it("includes checks object with database and redis keys", async () => {
    const res = await app.request("/api/health");
    const data = await res.json();
    expect(data.checks).toBeDefined();
    expect(data.checks.database).toBeDefined();
    expect(data.checks.redis).toBeDefined();
  });

  it("includes response_time_ms as a number", async () => {
    const res = await app.request("/api/health");
    const data = await res.json();
    expect(typeof data.response_time_ms).toBe("number");
  });

  it("includes environment field", async () => {
    const res = await app.request("/api/health");
    const data = await res.json();
    expect(data.environment).toBeDefined();
  });
});

describe("GET /api/health/error-monitoring", () => {
  it("returns 200 or 503", async () => {
    const res = await app.request("/api/health/error-monitoring");
    expect([200, 503]).toContain(res.status);
    const data = await res.json();
    expect(data.metrics !== undefined || data.error !== undefined).toBe(true);
  });
});
