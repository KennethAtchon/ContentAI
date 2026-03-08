/**
 * Unit tests for pagination utilities
 */
import { describe, expect, test } from "bun:test";
import {
  parsePaginationParams,
  createPaginationMeta,
  createPaginatedResponse,
  createSearchConditions,
  createDateRangeConditions,
} from "@/shared/utils/helpers/pagination";

describe("pagination utilities", () => {
  describe("parsePaginationParams", () => {
    test("should use defaults when params are empty", () => {
      const result = parsePaginationParams({});
      expect(result).toEqual({ page: 1, limit: 20, skip: 0, search: "" });
    });

    test("should parse page and limit from string params", () => {
      const result = parsePaginationParams({
        page: "3",
        limit: "10",
      });
      expect(result).toEqual({ page: 3, limit: 10, skip: 20, search: "" });
    });

    test("should use custom defaultLimit and maxLimit", () => {
      const result = parsePaginationParams(
        { page: "1", limit: "500" },
        { defaultLimit: 10, maxLimit: 50 }
      );
      expect(result.limit).toBe(50);
    });

    test("should clamp limit to minLimit and maxLimit", () => {
      expect(
        parsePaginationParams({ limit: "0" }, { minLimit: 5, maxLimit: 100 })
      ).toMatchObject({ limit: 5 });
      expect(
        parsePaginationParams({ limit: "200" }, { maxLimit: 100 })
      ).toMatchObject({ limit: 100 });
    });

    test("should default to page 1 for invalid or negative page", () => {
      expect(parsePaginationParams({ page: "0" }).page).toBe(1);
      expect(parsePaginationParams({ page: "-1" }).page).toBe(1);
      expect(parsePaginationParams({ page: "abc" }).page).toBe(1);
    });

    test("should trim and pass through search", () => {
      const result = parsePaginationParams({ search: "  foo  " });
      expect(result.search).toBe("foo");
    });
  });

  describe("createPaginationMeta", () => {
    test("should compute meta for first page", () => {
      const meta = createPaginationMeta(100, 1, 10, 10);
      expect(meta).toEqual({
        total: 100,
        page: 1,
        limit: 10,
        totalPages: 10,
        hasMore: true,
        hasPrevious: false,
        showing: 10,
        from: 1,
        to: 10,
      });
    });

    test("should compute meta for middle page", () => {
      const meta = createPaginationMeta(100, 3, 10, 10);
      expect(meta).toEqual({
        total: 100,
        page: 3,
        limit: 10,
        totalPages: 10,
        hasMore: true,
        hasPrevious: true,
        showing: 10,
        from: 21,
        to: 30,
      });
    });

    test("should compute meta for last partial page", () => {
      const meta = createPaginationMeta(25, 3, 10, 5);
      expect(meta).toEqual({
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
        hasMore: false,
        hasPrevious: true,
        showing: 5,
        from: 21,
        to: 25,
      });
    });
  });

  describe("createPaginatedResponse", () => {
    test("should return data and pagination", () => {
      const res = createPaginatedResponse([{ id: 1 }, { id: 2 }], 50, 1, 10);
      expect(res.data).toHaveLength(2);
      expect(res.pagination.total).toBe(50);
      expect(res.pagination.page).toBe(1);
      expect(res.pagination.limit).toBe(10);
      expect(res.pagination.totalPages).toBe(5);
    });
  });

  describe("createSearchConditions", () => {
    test("should return undefined for empty or short search", () => {
      expect(createSearchConditions("", ["name"])).toBeUndefined();
      expect(createSearchConditions("a", ["name"])).toBeUndefined();
    });

    test("should return single-field condition when one field", () => {
      const cond = createSearchConditions("foo", ["name"]);
      expect(cond).toEqual({
        name: { contains: "foo", mode: "insensitive" },
      });
    });

    test("should return OR conditions for multiple fields", () => {
      const cond = createSearchConditions("bar", ["name", "email"]);
      expect(cond).toEqual({
        OR: [
          { name: { contains: "bar", mode: "insensitive" } },
          { email: { contains: "bar", mode: "insensitive" } },
        ],
      });
    });
  });

  describe("createDateRangeConditions", () => {
    test("should return undefined when no dates", () => {
      expect(createDateRangeConditions(null, null)).toBeUndefined();
      expect(createDateRangeConditions(undefined, undefined)).toBeUndefined();
    });

    test("should return gte only when dateFrom set", () => {
      const cond = createDateRangeConditions("2024-01-01", null);
      expect(cond).toEqual({
        createdAt: { gte: new Date("2024-01-01") },
      });
    });

    test("should return lte only when dateTo set", () => {
      const cond = createDateRangeConditions(null, "2024-12-31");
      expect(cond).toEqual({
        createdAt: { lte: new Date("2024-12-31") },
      });
    });

    test("should use custom dateField", () => {
      const cond = createDateRangeConditions(
        "2024-01-01",
        "2024-12-31",
        "updatedAt"
      );
      expect(cond).toEqual({
        updatedAt: {
          gte: new Date("2024-01-01"),
          lte: new Date("2024-12-31"),
        },
      });
    });
  });
});
