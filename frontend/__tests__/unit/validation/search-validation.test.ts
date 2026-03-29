/**
 * Search validation schemas and helpers – customer, order, user search, validateSearchInput, sanitizeSearchTerm.
 */
import { describe, expect, test } from "bun:test";
import {
  customerSearchSchema,
  orderSearchSchema,
  userSearchSchema,
  dbHealthSchema,
  idSchema,
  emailSchema,
  validateSearchInput,
  sanitizeSearchTerm,
} from "@/shared/validation/search.schema";

describe("search-validation", () => {
  describe("customerSearchSchema", () => {
    test("accepts empty query with defaults", () => {
      const result = customerSearchSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe("");
      }
    });

    test("parses page and limit", () => {
      const result = customerSearchSchema.safeParse({
        page: "5",
        limit: "50",
        search: "john",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(50);
        expect(result.data.search).toBe("john");
      }
    });

    test("rejects search too short", () => {
      const result = customerSearchSchema.safeParse({
        search: "x",
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid characters in search", () => {
      const result = customerSearchSchema.safeParse({
        search: "test<script>",
      });
      expect(result.success).toBe(false);
    });

    test("rejects SQL injection in search", () => {
      const result = customerSearchSchema.safeParse({
        search: "'; DROP TABLE users;--",
      });
      expect(result.success).toBe(false);
    });

    test("handles null/undefined search", () => {
      const result = customerSearchSchema.safeParse({
        search: null,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.search).toBe("");
    });
  });

  describe("orderSearchSchema", () => {
    test("accepts valid customerId UUID", () => {
      const result = orderSearchSchema.safeParse({
        customerId: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    test("rejects invalid customerId", () => {
      const result = orderSearchSchema.safeParse({
        customerId: "not-uuid",
      });
      expect(result.success).toBe(false);
    });

    test("rejects search length 0 when provided", () => {
      const result = orderSearchSchema.safeParse({
        search: "a",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("userSearchSchema", () => {
    test("accepts valid search", () => {
      const result = userSearchSchema.safeParse({
        page: "1",
        limit: "10",
        search: "alice",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("dbHealthSchema", () => {
    test("accepts minutes in range", () => {
      const result = dbHealthSchema.safeParse({ minutes: 60 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.minutes).toBe(60);
    });

    test("rejects minutes out of range", () => {
      expect(dbHealthSchema.safeParse({ minutes: 0 }).success).toBe(false);
      expect(dbHealthSchema.safeParse({ minutes: 2000 }).success).toBe(false);
    });
  });

  describe("idSchema", () => {
    test("accepts valid UUID", () => {
      expect(
        idSchema.safeParse("123e4567-e89b-12d3-a456-426614174000").success
      ).toBe(true);
    });
    test("rejects invalid UUID", () => {
      expect(idSchema.safeParse("x").success).toBe(false);
    });
  });

  describe("emailSchema", () => {
    test("accepts valid email", () => {
      expect(emailSchema.safeParse("a@b.co").success).toBe(true);
    });
    test("rejects SQL injection in email", () => {
      expect(
        emailSchema.safeParse("a@b.co'; DROP TABLE users;--").success
      ).toBe(false);
    });
  });

  describe("validateSearchInput", () => {
    const schema = customerSearchSchema;

    test("returns success for valid input", () => {
      const result = validateSearchInput(
        schema,
        { page: "1", limit: "20" },
        "test"
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBeDefined();
    });

    test("returns ZodError message for invalid input", () => {
      const result = validateSearchInput(schema, { search: "x" }, "test");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBeTruthy();
    });

    test("returns generic error for non-ZodError", () => {
      const throwingSchema = {
        parse: () => {
          throw new Error("custom");
        },
      } as any;
      const result = validateSearchInput(throwingSchema, {}, "test");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid input");
    });
  });

  describe("sanitizeSearchTerm", () => {
    test("returns empty for null/undefined", () => {
      expect(sanitizeSearchTerm(null)).toBe("");
      expect(sanitizeSearchTerm(undefined)).toBe("");
    });

    test("returns empty for non-string", () => {
      expect(sanitizeSearchTerm(123 as any)).toBe("");
    });

    test("trims and removes disallowed chars (keeps allowed like @)", () => {
      expect(sanitizeSearchTerm("  hello@world  ")).toBe("hello@world");
    });

    test("limits length to 100", () => {
      const long = "a".repeat(150);
      expect(sanitizeSearchTerm(long).length).toBe(100);
    });
  });
});
