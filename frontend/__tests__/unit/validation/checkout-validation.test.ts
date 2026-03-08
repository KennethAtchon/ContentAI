/**
 * Checkout validation – schema, validateField, formatPhoneNumber, formatZipCode.
 */
import { describe, expect, test } from "bun:test";
import {
  checkoutValidationSchema,
  validateField,
  formatPhoneNumber,
  formatZipCode,
} from "@/shared/utils/validation/checkout-validation";

describe("checkout-validation", () => {
  const validBase = {
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "5551234567",
    contactMethod: "email" as const,
    address: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    agreeToTerms: true,
  };

  describe("checkoutValidationSchema", () => {
    test("accepts valid data with notes optional", () => {
      const result = checkoutValidationSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });
    test("accepts notes empty string", () => {
      const result = checkoutValidationSchema.safeParse({
        ...validBase,
        notes: "",
      });
      expect(result.success).toBe(true);
    });
    test("rejects phone with only 6 digits (e.g. 123-456)", () => {
      const result = checkoutValidationSchema.safeParse({
        ...validBase,
        phone: "123-456",
      });
      expect(result.success).toBe(false);
    });
    test("rejects phone with letters", () => {
      const result = checkoutValidationSchema.safeParse({
        ...validBase,
        phone: "555-CALL-NOW",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateField", () => {
    test("state: valid", () => {
      const r = validateField.state("CA");
      expect(r.isValid).toBe(true);
    });
    test("state: invalid", () => {
      const r = validateField.state("XX");
      expect(r.isValid).toBe(false);
    });
    test("zip: valid", () => {
      const r = validateField.zip("94102");
      expect(r.isValid).toBe(true);
    });
    test("zip: invalid", () => {
      const r = validateField.zip("1234");
      expect(r.isValid).toBe(false);
    });
    test("address: valid", () => {
      const r = validateField.address("123 Main St, Apt 4");
      expect(r.isValid).toBe(true);
    });
    test("city: valid", () => {
      const r = validateField.city("San Francisco");
      expect(r.isValid).toBe(true);
    });
  });

  describe("formatPhoneNumber", () => {
    test("empty returns empty", () => {
      expect(formatPhoneNumber("")).toBe("");
    });
    test("<=3 digits returns as-is", () => {
      expect(formatPhoneNumber("123")).toBe("123");
    });
    test("<=6 digits returns (XXX) XXX", () => {
      expect(formatPhoneNumber("123456")).toBe("(123) 456");
    });
    test("10 digits returns (XXX) XXX-XXXX", () => {
      expect(formatPhoneNumber("5551234567")).toBe("(555) 123-4567");
    });
  });

  describe("formatZipCode", () => {
    test("empty returns empty", () => {
      expect(formatZipCode("")).toBe("");
    });
    test("<=5 digits returns as-is", () => {
      expect(formatZipCode("94102")).toBe("94102");
    });
    test("zip+4 format", () => {
      expect(formatZipCode("941021234")).toBe("94102-1234");
    });
  });
});
