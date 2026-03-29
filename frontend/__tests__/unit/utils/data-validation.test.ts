/**
 * Data validation utilities in `shared/validation/data.schema.ts`.
 */
import { describe, expect, test } from "bun:test";
import {
  safeParseDate,
  safeFormatTimeWithTimezone,
  safeFormatDateWithTimezone,
  safeArray,
  safeFormatPrice,
  validateApiResponse,
  safeJsonParse,
  isValidEmail,
  isValidPhone,
} from "@/shared/validation/data.schema";

describe("data-validation", () => {
  describe("safeParseDate", () => {
    test("returns null for null/undefined", () => {
      expect(safeParseDate(null)).toBeNull();
      expect(safeParseDate(undefined)).toBeNull();
    });
    test("returns null for invalid date string", () => {
      expect(safeParseDate("not-a-date")).toBeNull();
    });
    test("returns null for NaN date", () => {
      expect(safeParseDate("Invalid")).toBeNull();
    });
    test("returns null for year out of bounds", () => {
      expect(safeParseDate("1899-01-01")).toBeNull();
      expect(safeParseDate("2101-01-01")).toBeNull();
    });
    test("returns Date for valid string", () => {
      const d = safeParseDate("2024-06-15");
      expect(d).toBeInstanceOf(Date);
      expect(d!.getFullYear()).toBe(2024);
    });
    test("returns Date for Date input", () => {
      const input = new Date("2024-06-15");
      expect(safeParseDate(input)).toEqual(input);
    });
  });

  describe("safeFormatTimeWithTimezone", () => {
    test("returns fallback for null/undefined", () => {
      expect(safeFormatTimeWithTimezone(null, "UTC")).toBe("Invalid time");
      expect(safeFormatTimeWithTimezone(undefined, "UTC")).toBe("Invalid time");
    });
    test("calls TimeService for valid date", () => {
      const result = safeFormatTimeWithTimezone(
        "2024-06-15T12:00:00Z",
        "America/New_York"
      );
      expect(result).toBeDefined();
      expect(result).not.toBe("Invalid time");
    });
  });

  describe("safeFormatDateWithTimezone", () => {
    test("returns fallback for null/undefined", () => {
      expect(safeFormatDateWithTimezone(null, "UTC")).toBe("Invalid date");
    });
    test("calls TimeService for valid date", () => {
      const result = safeFormatDateWithTimezone("2024-06-15", "UTC");
      expect(result).toBeDefined();
      expect(result).not.toBe("Invalid date");
    });
  });

  describe("safeArray", () => {
    test("returns array as-is", () => {
      const arr = [1, 2];
      expect(safeArray(arr)).toBe(arr);
    });
    test("returns [] for null/undefined", () => {
      expect(safeArray(null)).toEqual([]);
      expect(safeArray(undefined)).toEqual([]);
    });
  });

  describe("safeFormatPrice", () => {
    test("returns $0.00 for null/undefined", () => {
      expect(safeFormatPrice(null)).toBe("$0.00");
      expect(safeFormatPrice(undefined)).toBe("$0.00");
    });
    test("formats number", () => {
      expect(safeFormatPrice(99.5)).toBe("$99.50");
    });
    test("formats string number", () => {
      expect(safeFormatPrice("42.25")).toBe("$42.25");
    });
    test("returns $0.00 for NaN", () => {
      expect(safeFormatPrice("not-number")).toBe("$0.00");
    });
    test("handles object with toString (e.g. Decimal)", () => {
      expect(safeFormatPrice({ toString: () => "10.99" })).toBe("$10.99");
    });
  });

  describe("validateApiResponse", () => {
    test("returns false for null/non-object", () => {
      expect(validateApiResponse(null, ["a"])).toBe(false);
      expect(validateApiResponse(123, ["a"])).toBe(false);
    });
    test("returns false when field missing", () => {
      expect(validateApiResponse({ a: 1 }, ["a", "b"])).toBe(false);
    });
    test("returns true when all fields present", () => {
      expect(validateApiResponse({ a: 1, b: 2 }, ["a", "b"])).toBe(true);
    });
  });

  describe("safeJsonParse", () => {
    test("returns fallback for null/undefined/non-string", () => {
      expect(safeJsonParse(null, 0)).toBe(0);
      expect(safeJsonParse(undefined, "x")).toBe("x");
      expect(safeJsonParse(123 as any, [])).toEqual([]);
    });
    test("parses valid JSON", () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });
    test("returns fallback on parse error", () => {
      expect(safeJsonParse("invalid", {})).toEqual({});
    });
  });

  describe("isValidEmail", () => {
    test("returns false for null/undefined/non-string", () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail(123 as any)).toBe(false);
    });
    test("returns true for valid email", () => {
      expect(isValidEmail("a@b.co")).toBe(true);
    });
    test("returns false for invalid email", () => {
      expect(isValidEmail("no-at")).toBe(false);
    });
  });

  describe("isValidPhone", () => {
    test("returns false for null/undefined/non-string", () => {
      expect(isValidPhone(null)).toBe(false);
    });
    test("returns true for 10-11 digits", () => {
      expect(isValidPhone("5551234567")).toBe(true);
      expect(isValidPhone("15551234567")).toBe(true);
    });
    test("returns false for too short/long", () => {
      expect(isValidPhone("123456789")).toBe(false);
      expect(isValidPhone("155512345678")).toBe(false);
    });
  });
});
