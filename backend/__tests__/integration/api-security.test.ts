/**
 * Integration tests for api-security (Hono adaptation).
 * TODO: Full test suite pending Hono route adaptation.
 */
import { describe, expect, test, mock } from "bun:test";
import { Hono } from "hono";

mock.module("@/middleware/protection", () => ({
  rateLimiter: () => async (_c: any, next: any) => next(),
  authMiddleware: () => async (_c: any, next: any) => next(),
  csrfMiddleware: () => async (_c: any, next: any) => next(),
  requireAuth: mock().mockResolvedValue({
    userId: "test-uid",
    firebaseUser: { uid: "test-uid", stripeRole: "basic" },
  }),
}));

const app = new Hono();
app.get("/api/live", (c) => c.json({ status: "ok" }));

describe("api-security integration", () => {
  test("Hono app responds to requests", async () => {
    const res = await app.request("/api/live");
    expect(res.status).toBe(200);
  });
});
