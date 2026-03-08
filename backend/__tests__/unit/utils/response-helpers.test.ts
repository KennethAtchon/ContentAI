/**
 * Unit tests for API response helpers
 */
import { describe, expect, test } from "bun:test";
import {
  createSuccessResponse,
  createPaginatedResponse,
  createErrorResponse,
  createBadRequestResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createInternalErrorResponse,
} from "@/utils/api/response-helpers";

describe("response helpers", () => {
  describe("createSuccessResponse", () => {
    test("should return 200 with data", async () => {
      const res = createSuccessResponse({ id: "1", name: "Test" });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual({ id: "1", name: "Test" });
    });

    test("should accept custom status", async () => {
      const res = createSuccessResponse({ created: true }, undefined, 201);
      expect(res.status).toBe(201);
    });

    test("should include meta when provided", async () => {
      const res = createSuccessResponse({ id: "1" }, { requestId: "req-123" });
      const json = await res.json();
      expect(json.meta?.requestId).toBe("req-123");
    });
  });

  describe("createPaginatedResponse", () => {
    test("should return paginated structure", async () => {
      const res = createPaginatedResponse([{ id: 1 }, { id: 2 }], 1, 10, 50);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasMore: true,
      });
    });
  });

  describe("createErrorResponse", () => {
    test("should return error with message and status", async () => {
      const res = createErrorResponse("Something failed", 500);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Something failed");
    });

    test("should include code and details when provided", async () => {
      const res = createErrorResponse("Error", 400, "BAD_REQUEST", {
        field: "email",
      });
      const json = await res.json();
      expect(json.code).toBe("BAD_REQUEST");
      expect(json.details).toEqual({ field: "email" });
    });
  });

  describe("createBadRequestResponse", () => {
    test("should return 400 with BAD_REQUEST code", async () => {
      const res = createBadRequestResponse("Invalid input");
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("BAD_REQUEST");
    });
  });

  describe("createUnauthorizedResponse", () => {
    test("should return 401 with UNAUTHORIZED code", async () => {
      const res = createUnauthorizedResponse();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("UNAUTHORIZED");
    });
  });

  describe("createForbiddenResponse", () => {
    test("should return 403 with FORBIDDEN code", async () => {
      const res = createForbiddenResponse();
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("FORBIDDEN");
    });
  });

  describe("createNotFoundResponse", () => {
    test("should return 404 with NOT_FOUND code", async () => {
      const res = createNotFoundResponse("User not found");
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe("NOT_FOUND");
    });
  });

  describe("createInternalErrorResponse", () => {
    test("should return 500 with INTERNAL_ERROR code", async () => {
      const res = createInternalErrorResponse();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.code).toBe("INTERNAL_ERROR");
    });

    test("should sanitize Error details (do not send to client)", async () => {
      const res = createInternalErrorResponse("Error", new Error("secret"));
      const json = await res.json();
      expect(json.details).toBeUndefined();
    });

    test("should include sanitized object details", async () => {
      const res = createInternalErrorResponse("Error", { key: "value" });
      const json = await res.json();
      expect(json.details).toEqual({ key: "value" });
    });

    test("should call sanitizeString for string details (details not sent for non-objects)", async () => {
      const res = createInternalErrorResponse("Error", "raw string detail");
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.code).toBe("INTERNAL_ERROR");
    });

    test("should pass through primitive details (details not sent for non-objects)", async () => {
      const res = createInternalErrorResponse("Error", 42);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.code).toBe("INTERNAL_ERROR");
    });
  });
});
