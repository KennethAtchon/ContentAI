/**
 * Unit tests for API error wrapper: withApiErrorHandling, error mapping, safeAsyncOperation, withStandardErrorHandling.
 * Uses preload mocks for debug; api-error-wrapper defines its own getClientIp helper.
 */

import { describe, it, expect } from "bun:test";

import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  withApiErrorHandling,
  withStandardErrorHandling,
  safeAsyncOperation,
  withTimeout,
  reportError,
} from "@/utils/error-handling/api-error-wrapper";

describe("api-error-wrapper", () => {
  describe("constants", () => {
    it("exports HTTP_STATUS with expected codes", () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.METHOD_NOT_ALLOWED).toBe(405);
      expect(HTTP_STATUS.RATE_LIMITED).toBe(429);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
      expect(HTTP_STATUS.GATEWAY_TIMEOUT).toBe(504);
    });

    it("exports ERROR_MESSAGES", () => {
      expect(ERROR_MESSAGES.INTERNAL_ERROR).toBe(
        "An internal server error occurred",
      );
      expect(ERROR_MESSAGES.UNAUTHORIZED).toBe("Authentication required");
      expect(ERROR_MESSAGES.NOT_FOUND).toBe("Resource not found");
    });
  });

  describe("withApiErrorHandling", () => {
    it("returns handler response when handler succeeds", async () => {
      const handler = async (_req: any) =>
        (global as any).Response.json({ ok: true }, { status: 200 });
      const wrapped = withApiErrorHandling(handler);
      const req = new (global as any).Request("https://example.com/api");
      const res = await wrapped(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ ok: true });
    });

    it("returns 405 when method not in allowedMethods", async () => {
      const handler = async (_req: any) =>
        (global as any).Response.json({}, { status: 200 });
      const wrapped = withApiErrorHandling(handler, {
        allowedMethods: ["POST"],
      });
      const req = new (global as any).Request("https://example.com/api", {
        method: "GET",
      });
      const res = await wrapped(req);
      expect(res.status).toBe(405);
      const data = await res.json();
      expect(data.error).toBe(ERROR_MESSAGES.METHOD_NOT_ALLOWED);
      expect(data.allowedMethods).toEqual(["POST"]);
    });

    it("returns timeout error when handler exceeds timeout", async () => {
      const handler = async (_req: any) => {
        await new Promise((r) => setTimeout(r, 100));
        return (global as any).Response.json({});
      };
      const wrapped = withApiErrorHandling(handler, { timeoutMs: 10 });
      const req = new (global as any).Request("https://example.com/api");
      const res = await wrapped(req);
      expect(res.status).toBe(504);
      const data = await res.json();
      expect(data.error).toContain("timeout");
    });

    it("uses customErrorHandler when it returns a response", async () => {
      const customResponse = (global as any).Response.json(
        { custom: true },
        { status: 418 },
      );
      const customErrorHandler = () => customResponse;
      const handler = async (_req: any) => {
        throw new Error("any");
      };
      const wrapped = withApiErrorHandling(handler, {
        customErrorHandler,
      });
      const req = new (global as any).Request("https://example.com/api");
      const res = await wrapped(req);
      expect(res.status).toBe(418);
      const data = await res.json();
      expect(data.custom).toBe(true);
    });

    it("falls back to default when customErrorHandler returns null", async () => {
      const customErrorHandler = () => null;
      const handler = async (_req: any) => {
        throw new Error("validation failed");
      };
      const wrapped = withApiErrorHandling(handler, {
        customErrorHandler,
      });
      const req = new (global as any).Request("https://example.com/api");
      const res = await wrapped(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("validation failed");
    });

    it("maps database error to 503", async () => {
      const handler = async () => {
        throw new Error("database connection pool timeout");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe(ERROR_MESSAGES.DATABASE_ERROR);
    });

    it("maps unauthorized to 401", async () => {
      const handler = async () => {
        throw new Error("Unauthorized");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe(ERROR_MESSAGES.UNAUTHORIZED);
    });

    it("maps forbidden to 403", async () => {
      const handler = async () => {
        throw new Error("Access denied");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe(ERROR_MESSAGES.FORBIDDEN);
    });

    it("maps validation error to 400 with message", async () => {
      const handler = async () => {
        throw new Error("Invalid email format");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Invalid email format");
    });

    it("maps rate limit error to 429", async () => {
      const handler = async () => {
        throw new Error("Rate limit exceeded");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(429);
      expect((await res.json()).error).toBe(ERROR_MESSAGES.RATE_LIMITED);
    });

    it("maps timeout error to 504", async () => {
      const handler = async () => {
        throw new Error("Request timed out");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(504);
      expect((await res.json()).error).toBe(ERROR_MESSAGES.TIMEOUT);
    });

    it("maps external/fetch error to 502", async () => {
      const handler = async () => {
        throw new Error("Fetch failed");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(502);
      expect((await res.json()).error).toBe(
        ERROR_MESSAGES.EXTERNAL_SERVICE_ERROR,
      );
    });

    it("maps not found to 404", async () => {
      const handler = async () => {
        throw new Error("Resource not found");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it("maps unknown error to 500", async () => {
      const handler = async () => {
        throw new Error("Something broke");
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });

    it("converts non-Error throw to Error", async () => {
      const handler = async () => {
        throw "string error";
      };
      const wrapped = withApiErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(500);
    });
  });

  describe("withStandardErrorHandling", () => {
    it("wraps handler and returns response on success", async () => {
      const handler = async (_req: any) =>
        (global as any).Response.json({ done: true });
      const wrapped = withStandardErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ done: true });
    });

    it("returns 500 on thrown error", async () => {
      const handler = async () => {
        throw new Error("unhandled");
      };
      const wrapped = withStandardErrorHandling(handler);
      const res = await wrapped(
        new (global as any).Request("https://example.com/api"),
      );
      expect(res.status).toBe(500);
    });
  });

  describe("safeAsyncOperation", () => {
    it("returns result when operation succeeds", async () => {
      const result = await safeAsyncOperation(async () => "ok", "test", 5000);
      expect(result).toBe("ok");
    });

    it("throws when operation throws", async () => {
      await expect(
        safeAsyncOperation(async () => {
          throw new Error("fail");
        }, "test"),
      ).rejects.toThrow("fail");
    });

    it("throws when operation times out", async () => {
      await expect(
        safeAsyncOperation(
          () => new Promise((r) => setTimeout(() => r(1), 200)),
          "test",
          10,
        ),
      ).rejects.toThrow(/timeout/);
    });
  });

  describe("withTimeout", () => {
    it("resolves with value when promise resolves in time", async () => {
      const value = await withTimeout(
        Promise.resolve(42),
        1000,
        "test timeout",
      );
      expect(value).toBe(42);
    });

    it("rejects when promise exceeds timeout", async () => {
      await expect(
        withTimeout(new Promise((r) => setTimeout(() => r(1), 100)), 10, "op"),
      ).rejects.toThrow(/op.*10ms/);
    });

    it("rejects with inner error when promise rejects", async () => {
      await expect(
        withTimeout(Promise.reject(new Error("inner")), 5000, "op"),
      ).rejects.toThrow("inner");
    });
  });

  describe("reportError", () => {
    it("returns structured error (re-export from global-error-handler)", () => {
      const err = new Error("test report");
      const out = reportError(err, { requestId: "r1" });
      expect(out).toBeDefined();
      expect(out.id).toMatch(/^err_/);
      expect(out.message).toBe("test report");
      expect(out.context?.requestId).toBe("r1");
    });
  });
});
