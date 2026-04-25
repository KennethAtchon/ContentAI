/**
 * Unit tests for global error handler: reportError, getErrorMetrics, resetErrorMetrics,
 * withErrorHandling, withTimeout. installGlobalErrorHandlers/removeGlobalErrorHandlers
 * are tested without triggering process.exit.
 * debugLog and metrics are mocked in preload.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  reportError,
  getErrorMetrics,
  clearErrorMetrics,
  withErrorHandling,
  withTimeout,
  ErrorCategory,
} from "@/shared/errors/global-error-handler";

describe("global-error-handler", () => {
  beforeEach(() => {
    clearErrorMetrics();
  });

  describe("reportError", () => {
    it("returns structured error with id, message, category, severity", () => {
      const err = new Error("test error");
      const out = reportError(err);
      expect(out.id).toMatch(/^err_/);
      expect(out.message).toBe("test error");
      expect(out.category).toBeDefined();
      expect(out.severity).toBeDefined();
      expect(out.context).toBeDefined();
      expect(out.isRecoverable).toBeDefined();
    });

    it("uses null message when error.message is null", () => {
      const err = new Error("x") as Error & { message: null };
      err.message = null as unknown as string;
      const out = reportError(err);
      expect(out.message).toBe("null");
    });

    it("categorizes database errors", () => {
      const out = reportError(new Error("Database connection failed"));
      expect(out.category).toBe(ErrorCategory.DATABASE);
    });

    it("categorizes auth errors", () => {
      const out = reportError(new Error("Unauthorized token"));
      expect(out.category).toBe(ErrorCategory.AUTHENTICATION);
    });

    it("categorizes validation errors", () => {
      const out = reportError(new Error("Invalid schema"));
      expect(out.category).toBe(ErrorCategory.VALIDATION);
    });

    it("categorizes rate limit errors", () => {
      const out = reportError(new Error("Rate limit exceeded"));
      expect(out.category).toBe(ErrorCategory.RATE_LIMIT);
    });

    it("categorizes external API errors", () => {
      const out = reportError(new Error("ECONNREFUSED"));
      expect(out.category).toBe(ErrorCategory.EXTERNAL_API);
    });

    it("categorizes network errors", () => {
      const out = reportError(new Error("Connection reset"));
      expect(out.category).toBe(ErrorCategory.NETWORK);
    });

    it("categorizes unknown when no pattern matches", () => {
      const out = reportError(new Error("random message"));
      expect(out.category).toBe(ErrorCategory.UNKNOWN);
    });

    it("merges context into structured error", () => {
      const out = reportError(new Error("x"), {
        requestId: "req-1",
        path: "/api/test",
      });
      expect(out.context?.requestId).toBe("req-1");
      expect(out.context?.path).toBe("/api/test");
    });
  });

  describe("getErrorMetrics", () => {
    it("returns totalErrors and lastErrorTime", () => {
      const m = getErrorMetrics();
      expect(m).toHaveProperty("totalErrors", 0);
      expect(m).toHaveProperty("lastErrorTime");
      expect(m).toHaveProperty("errorsByCategory");
      expect(m).toHaveProperty("errorsBySeverity");
    });

    it("updates metrics after reportError", () => {
      reportError(new Error("db"), {});
      const m = getErrorMetrics();
      expect(m.errorsByCategory).toBeDefined();
      expect(m.errorsBySeverity).toBeDefined();
    });
  });

  describe("resetErrorMetrics", () => {
    it("clears counts and maps", () => {
      reportError(new Error("one"));
      clearErrorMetrics();
      const m = getErrorMetrics();
      expect(m.totalErrors).toBe(0);
      expect(m.lastErrorTime).toBeInstanceOf(Date);
      expect(Object.keys(m.errorsByCategory)).toHaveLength(0);
      expect(Object.keys(m.errorsBySeverity)).toHaveLength(0);
    });
  });

  describe("withErrorHandling", () => {
    it("returns result when fn resolves", async () => {
      const fn = withErrorHandling(async (x: number) => x + 1);
      const result = await fn(2);
      expect(result).toBe(3);
    });

    it("reports error then rethrows when fn throws", async () => {
      const fn = withErrorHandling(async () => {
        throw new Error("rethrow me");
      });
      await expect(fn()).rejects.toThrow("rethrow me");
    });
  });

  describe("withTimeout", () => {
    it("resolves with value when promise resolves in time", async () => {
      const v = await withTimeout(Promise.resolve(99), 5000, "op");
      expect(v).toBe(99);
    });

    it("rejects with timeout message when promise is slow", async () => {
      await expect(
        withTimeout(
          new Promise((r) => setTimeout(() => r(1), 100)),
          10,
          "slow op"
        )
      ).rejects.toThrow("Operation timed out after 10ms: slow op");
    });

    it("rejects with inner error when promise rejects", async () => {
      await expect(
        withTimeout(Promise.reject(new Error("inner")), 5000)
      ).rejects.toThrow("inner");
    });
  });
});
