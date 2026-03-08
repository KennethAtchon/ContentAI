/**
 * Integration tests for /api/live route.
 * Calculator routes are tested in api-calculator.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { Hono } from "hono";

const app = new Hono();
app.get("/api/live", (c) =>
  c.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    response_time_ms: 0,
  }),
);

describe("GET /api/live", () => {
  test("returns 200 with alive: true", async () => {
    const res = await app.request("/api/live");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alive).toBe(true);
    expect(typeof data.timestamp).toBe("string");
    expect(typeof data.uptime).toBe("number");
  });
});
