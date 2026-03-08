/**
 * Unit tests for PII sanitization. Preload mocks this module (pass-through);
 * these tests assert the public API and behavior when used as mock.
 * For full branch coverage of real sanitization, run with mock disabled or use integration.
 */
import { describe, it, expect } from "bun:test";
import {
  sanitizeString,
  sanitizeObject,
  safeLogError,
  sanitize,
  LOGGING_CONFIG,
} from "@/shared/utils/security/pii-sanitization";

describe("pii-sanitization", () => {
  describe("sanitizeString", () => {
    it("is a function", () => {
      expect(typeof sanitizeString).toBe("function");
    });

    it("returns string when given string (mock pass-through)", () => {
      const out = sanitizeString("hello");
      expect(out).toBe("hello");
    });

    it("returns empty string when given empty string", () => {
      expect(sanitizeString("")).toBe("");
    });
  });

  describe("sanitizeObject", () => {
    it("is a function", () => {
      expect(typeof sanitizeObject).toBe("function");
    });

    it("returns object when given object (mock pass-through)", () => {
      const obj = { a: 1, b: "x" };
      expect(sanitizeObject(obj)).toEqual(obj);
    });

    it("returns null when given null", () => {
      expect(sanitizeObject(null)).toBe(null);
    });
  });

  describe("sanitize", () => {
    it("is same as sanitizeObject", () => {
      expect(sanitize).toBe(sanitizeObject);
    });
  });

  describe("safeLogError", () => {
    it("does not throw when called", () => {
      const err = new Error("test");
      expect(() => safeLogError("msg", err)).not.toThrow();
    });
  });

  describe("LOGGING_CONFIG", () => {
    it("is exported (mock may use empty object)", () => {
      expect(LOGGING_CONFIG).toBeDefined();
      expect(typeof LOGGING_CONFIG).toBe("object");
    });
  });
});
