/**
 * Contact validation – schema, validateContactField, validateContactForm, formatContactPhoneNumber.
 */
import { describe, expect, test } from "bun:test";
import {
  validateContactField,
  validateContactForm,
  formatContactPhoneNumber,
} from "@/utils/validation/contact-validation";

describe("contact-validation", () => {
  describe("validateContactField.phone", () => {
    test("empty string is valid (optional)", () => {
      const r = validateContactField.phone("");
      expect(r.isValid).toBe(true);
    });
    test("whitespace-only is valid", () => {
      const r = validateContactField.phone("   ");
      expect(r.isValid).toBe(true);
    });
    test("valid phone", () => {
      const r = validateContactField.phone("+1 555 123 4567");
      expect(r.isValid).toBe(true);
    });
    test("invalid phone", () => {
      const r = validateContactField.phone("12");
      expect(r.isValid).toBe(false);
    });
  });

  describe("validateContactForm", () => {
    test("valid data returns isValid true and empty errors", () => {
      const result = validateContactForm({
        name: "John Doe",
        email: "john@example.com",
        subject: "Hello",
        message: "This is a long enough message here.",
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });
    test("invalid data returns errors by path", () => {
      const result = validateContactForm({
        name: "",
        email: "bad",
        subject: "Hi",
        message: "short",
      });
      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    });
  });

  describe("formatContactPhoneNumber", () => {
    test("empty returns empty", () => {
      expect(formatContactPhoneNumber("")).toBe("");
    });
    test("formats 10 digits", () => {
      expect(formatContactPhoneNumber("5551234567")).toBe("(555) 123-4567");
    });
  });
});
