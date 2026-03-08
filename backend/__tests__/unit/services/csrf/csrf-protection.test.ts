/**
 * CSRF protection – module exports and behavior (preload mocks this module for app tests).
 * Tests cover generateCSRFToken, validateCSRFToken, getCSRFTokenResponse, requireCSRFToken, extractCSRFToken.
 */
import { describe, expect, test } from "bun:test";
import {
  generateCSRFToken,
  validateCSRFToken,
  getCSRFTokenResponse,
  requireCSRFToken,
  extractCSRFToken,
} from "@/services/csrf/csrf-protection";

const TEST_UID = "test-firebase-uid-123";

describe("csrf-protection", () => {
  describe("generateCSRFToken", () => {
    test("returns non-empty string", () => {
      const token = generateCSRFToken(TEST_UID);
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe("validateCSRFToken", () => {
    test("returns true for token from generateCSRFToken", () => {
      const token = generateCSRFToken(TEST_UID);
      expect(validateCSRFToken(token, TEST_UID)).toBe(true);
    });
  });

  describe("getCSRFTokenResponse", () => {
    test("returns token and expires", () => {
      const res = getCSRFTokenResponse(TEST_UID);
      expect(res.csrfToken).toBeDefined();
      expect(res.expires).toBeDefined();
      expect(validateCSRFToken(res.csrfToken, TEST_UID)).toBe(true);
    });
  });

  describe("requireCSRFToken", () => {
    test("is a function and can be called", async () => {
      expect(typeof requireCSRFToken).toBe("function");
      const req = new Request("http://localhost/api", { method: "GET" }) as any;
      const result = await requireCSRFToken(req, TEST_UID);
      expect(result === true || result === false || result === undefined).toBe(
        true,
      );
    });
  });

  describe("extractCSRFToken", () => {
    test("returns token from X-CSRF-Token header", async () => {
      const req = new Request("http://localhost/api", {
        headers: { "X-CSRF-Token": "  my-token  " },
      }) as any;
      const token = await extractCSRFToken(req);
      expect(token).toBe("my-token");
    });

    test("returns null when no header", async () => {
      const req = new Request("http://localhost/api") as any;
      const token = await extractCSRFToken(req);
      expect(token).toBeNull();
    });
  });
});
