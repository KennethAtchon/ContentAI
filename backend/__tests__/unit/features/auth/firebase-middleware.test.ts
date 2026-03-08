/**
 * Unit tests for middleware/protection.ts.
 * Tests that authMiddleware and rateLimiter are factory functions.
 * Behavioral tests (401/403/404) are covered by integration tests.
 */
import { describe, it, expect } from "bun:test";
import { authMiddleware, rateLimiter } from "@/middleware/protection";

describe("authMiddleware", () => {
  it("is a function", () => {
    expect(typeof authMiddleware).toBe("function");
  });

  it("authMiddleware('user') returns a middleware handler", () => {
    expect(typeof authMiddleware("user")).toBe("function");
  });

  it("authMiddleware('admin') returns a middleware handler", () => {
    expect(typeof authMiddleware("admin")).toBe("function");
  });
});

describe("rateLimiter", () => {
  it("is a function", () => {
    expect(typeof rateLimiter).toBe("function");
  });

  it("rateLimiter('public') returns a middleware handler", () => {
    expect(typeof rateLimiter("public")).toBe("function");
  });

  it("rateLimiter('health') returns a middleware handler", () => {
    expect(typeof rateLimiter("health")).toBe("function");
  });
});
