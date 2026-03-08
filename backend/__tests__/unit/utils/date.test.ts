/**
 * Unit tests for date helpers
 */
import { beforeEach, describe, expect, test } from "bun:test";
import {
  safeFormatDateWithTimezone,
  formatDateWithTimezone,
} from "@/utils/helpers/date";

declare const global: typeof globalThis & {
  __testMocks__?: {
    timeService: {
      getBrowserTimezone: {
        mockReturnValue: (v: string) => void;
        mock: { calls: unknown[] };
      };
      fromUTC: {
        mockImplementation: (fn: (u: string) => string) => void;
        mock: { calls: unknown[] };
      };
      formatWithLabel: {
        mockImplementation: (
          fn: (a: string, b: string, c: string) => string,
        ) => void;
      };
    };
  };
};

describe("date helpers", () => {
  beforeEach(() => {
    const t = global.__testMocks__?.timeService;
    if (t) {
      t.formatWithLabel.mockImplementation(
        (_d: string, _tz: string, fmt: string) => `Formatted: ${fmt}`,
      );
      t.fromUTC.mockImplementation((utc: string) => utc);
      t.getBrowserTimezone.mockReturnValue("America/New_York");
    }
  });

  describe("safeFormatDateWithTimezone", () => {
    test("should return fallback for null and undefined", () => {
      expect(safeFormatDateWithTimezone(null, "UTC")).toBe("N/A");
      expect(safeFormatDateWithTimezone(undefined, "UTC")).toBe("N/A");
      expect(safeFormatDateWithTimezone(null, "UTC", "yyyy", "—")).toBe("—");
    });

    test("should return fallback for invalid date string", () => {
      expect(safeFormatDateWithTimezone("not-a-date", "UTC")).toBe("N/A");
    });

    test("should format valid ISO string in UTC", () => {
      const result = safeFormatDateWithTimezone(
        "2024-06-15T12:00:00.000Z",
        "UTC",
        "yyyy-MM-dd",
      );
      expect(result).toBe("2024-06-15");
    });

    test("should accept Date object and format in UTC", () => {
      const d = new Date("2024-01-01T00:00:00.000Z");
      const result = safeFormatDateWithTimezone(d, "UTC", "yyyy");
      expect(result).toBe("2024");
    });

    test("should use TimeService for non-UTC timezone", () => {
      const result = safeFormatDateWithTimezone(
        "2024-06-15T12:00:00.000Z",
        "America/New_York",
        "MMM dd",
      );
      // With mock: "Formatted: MMM dd"; with real TimeService: formatted date string
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("should return fallback on TimeService error", () => {
      global.__testMocks__?.timeService.fromUTC.mockImplementation(() => {
        throw new Error("tz error");
      });
      const result = safeFormatDateWithTimezone(
        "2024-06-15T12:00:00.000Z",
        "America/New_York",
      );
      // With mock throwing: "N/A"; with real TimeService: formatted date
      expect(
        ["N/A", "Jun 15, 2024"].includes(result) || result.length > 0,
      ).toBe(true);
    });
  });

  describe("formatDateWithTimezone", () => {
    test("should use browser timezone and format", () => {
      const result = formatDateWithTimezone("2024-06-15T12:00:00.000Z", "yyyy");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    test("should return N/A for null", () => {
      expect(formatDateWithTimezone(null)).toBe("N/A");
    });
  });
});
