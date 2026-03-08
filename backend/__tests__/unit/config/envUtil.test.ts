/**
 * Config / envUtil – getAllowedCorsOrigins, shouldUseSecureCookies, and env-derived constants.
 * Other branches (getEnvVar client/required, getEnvVarAsBoolean) are covered indirectly via exports.
 */
import { describe, expect, test } from "bun:test";
import {
  getAllowedCorsOrigins,
  shouldUseSecureCookies,
  APP_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_TEST,
  CORS_ALLOWED_ORIGINS,
  BASE_URL,
  PACKAGE_VERSION,
  E2E_BASE_URL,
  IS_CI,
  IS_RAILWAY,
  METRICS_SECRET,
  LOG_LEVEL,
} from "@/utils/config/envUtil";

describe("envUtil", () => {
  describe("getAllowedCorsOrigins", () => {
    test("returns CORS_ALLOWED_ORIGINS when not in development", () => {
      // In test env APP_ENV is "test", so we get the non-development branch
      const origins = getAllowedCorsOrigins();
      expect(Array.isArray(origins)).toBe(true);
      expect(origins).toEqual(CORS_ALLOWED_ORIGINS);
    });

    test("returns array of strings (development or CORS list)", async () => {
      const mod = await import("@/utils/config/envUtil");
      const origins = mod.getAllowedCorsOrigins();
      expect(Array.isArray(origins)).toBe(true);
      origins.forEach((o) => expect(typeof o).toBe("string"));
    });
  });

  describe("shouldUseSecureCookies", () => {
    test("returns false when not production", () => {
      expect(shouldUseSecureCookies()).toBe(false);
    });
  });

  describe("env-derived constants", () => {
    test("APP_ENV is set", () => {
      expect(typeof APP_ENV).toBe("string");
      expect(["development", "test", "production"]).toContain(APP_ENV);
    });

    test("IS_TEST is true in test env", () => {
      expect(IS_TEST).toBe(true);
    });

    test("IS_PRODUCTION is boolean", () => {
      expect(typeof IS_PRODUCTION).toBe("boolean");
    });

    test("IS_DEVELOPMENT is boolean", () => {
      expect(typeof IS_DEVELOPMENT).toBe("boolean");
    });

    test("CORS_ALLOWED_ORIGINS is array", () => {
      expect(Array.isArray(CORS_ALLOWED_ORIGINS)).toBe(true);
    });

    test("BASE_URL is string", () => {
      expect(typeof BASE_URL).toBe("string");
    });

    test("PACKAGE_VERSION is string", () => {
      expect(typeof PACKAGE_VERSION).toBe("string");
    });

    test("E2E_BASE_URL has default", () => {
      expect(typeof E2E_BASE_URL).toBe("string");
      expect(E2E_BASE_URL.length).toBeGreaterThan(0);
    });

    test("IS_CI is boolean", () => {
      expect(typeof IS_CI).toBe("boolean");
    });

    test("IS_RAILWAY is boolean", () => {
      expect(typeof IS_RAILWAY).toBe("boolean");
    });

    test("METRICS_SECRET is string or empty", () => {
      expect(typeof METRICS_SECRET).toBe("string");
    });

    test("LOG_LEVEL is valid level", () => {
      expect(["debug", "info", "warn", "error"]).toContain(LOG_LEVEL);
    });
  });
});
