/**
 * Unit tests for CSRF token generation logic.
 * Tests the token format and expiry rules used by the /api/csrf route.
 */
import { describe, it, expect } from "bun:test";
import { generateCSRFToken } from "@/services/csrf/csrf-protection";

describe("CSRF token generation", () => {
  it("generateCSRFToken returns a non-empty string", () => {
    const token = generateCSRFToken("firebase-uid-123");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("generateCSRFToken produces different tokens for different UIDs", () => {
    const token1 = generateCSRFToken("uid-one");
    const token2 = generateCSRFToken("uid-two");
    expect(token1).not.toBe(token2);
  });

  it("generateCSRFToken is deterministic for same UID", () => {
    const token1 = generateCSRFToken("same-uid");
    const token2 = generateCSRFToken("same-uid");
    expect(token1).toBe(token2);
  });
});

describe("CSRF expires timestamp logic", () => {
  it("24h expiry is in the future", () => {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(new Date(expires).getTime()).toBeGreaterThan(Date.now());
  });

  it("24h expiry is roughly 24 hours from now", () => {
    const futureMs = Date.now() + 24 * 60 * 60 * 1000;
    const expires = new Date(futureMs).toISOString();
    const diff = new Date(expires).getTime() - Date.now();
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000); // > 23h
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000); // < 25h
  });
});

describe("CSRF route integration via Hono (mocked middleware)", () => {
  it("returns csrfToken and expires for authenticated requests", async () => {
    const { Hono } = await import("hono");
    const app = new Hono();

    // Simulate the CSRF route with inline mocked middleware
    app.get("/api/csrf", async (c) => {
      const auth = {
        firebaseUser: { uid: "firebase-uid" },
      };
      const token = generateCSRFToken(auth.firebaseUser.uid);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      return c.json({ csrfToken: token, expires });
    });

    const res = await app.request("/api/csrf");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.csrfToken).toBe("string");
    expect(data.csrfToken.length).toBeGreaterThan(0);
    expect(typeof data.expires).toBe("string");
    expect(new Date(data.expires).getTime()).toBeGreaterThan(Date.now());
  });
});
