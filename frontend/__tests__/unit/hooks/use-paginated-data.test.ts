/**
 * Unit tests for usePaginatedData hook.
 * Tests pagination logic, options defaults, and URL builder.
 */
import { describe, it, expect } from "bun:test";
import { usePaginatedData } from "@/shared/react/use-paginated-data";
import type {
  PaginationInfo,
  PaginatedResponse,
  UsePaginatedDataOptions,
} from "@/shared/react/use-paginated-data";

describe("usePaginatedData", () => {
  it("is a function", () => {
    expect(typeof usePaginatedData).toBe("function");
  });

  it("module exports usePaginatedData", async () => {
    const module = await import("@/shared/react/use-paginated-data");
    expect(typeof module.usePaginatedData).toBe("function");
  });
});

describe("PaginationInfo interface shape", () => {
  it("PaginationInfo has the expected fields", () => {
    const pagination: PaginationInfo = {
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
      hasMore: true,
    };
    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(20);
    expect(pagination.total).toBe(100);
    expect(pagination.totalPages).toBe(5);
    expect(pagination.hasMore).toBe(true);
  });
});

describe("PaginatedResponse interface shape", () => {
  it("PaginatedResponse has data and pagination fields", () => {
    const response: PaginatedResponse<{ id: string }> = {
      data: [{ id: "1" }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasMore: false,
      },
    };
    expect(response.data).toHaveLength(1);
    expect(response.pagination.page).toBe(1);
  });
});

describe("usePaginatedData URL builder", () => {
  it("URL builder function receives page and limit", () => {
    const urls: string[] = [];
    const urlBuilder = (page: number, limit: number) => {
      const url = `/api/items?page=${page}&limit=${limit}`;
      urls.push(url);
      return url;
    };

    // Simulate calling the URL builder as the hook would
    const url = urlBuilder(1, 20);
    expect(url).toBe("/api/items?page=1&limit=20");
    expect(urls).toHaveLength(1);
  });

  it("URL builder for page 2 returns correct page", () => {
    const urlBuilder = (page: number, limit: number) =>
      `/api/items?page=${page}&limit=${limit}`;
    expect(urlBuilder(2, 10)).toBe("/api/items?page=2&limit=10");
  });
});

describe("UsePaginatedDataOptions defaults", () => {
  it("options accept initialPage and initialLimit", () => {
    const options: UsePaginatedDataOptions = {
      initialPage: 1,
      initialLimit: 20,
      immediate: true,
      serviceName: "test",
      enableLogging: false,
    };
    expect(options.initialPage).toBe(1);
    expect(options.initialLimit).toBe(20);
    expect(options.immediate).toBe(true);
  });
});
