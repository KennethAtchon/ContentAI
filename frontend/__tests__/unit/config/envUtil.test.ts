/**
 * Config / envUtil – env-derived constants for the frontend (Vite-based).
 */
import { describe, expect, test } from "bun:test";
import {
  APP_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  IS_TEST,
  BASE_URL,
  API_URL,
  APP_NAME,
  LOG_LEVEL,
  DEBUG_ENABLED,
} from "@/shared/config/envUtil";

describe("envUtil", () => {
  describe("env-derived constants", () => {
    test("APP_ENV is set", () => {
      expect(typeof APP_ENV).toBe("string");
      expect(["development", "test", "production"]).toContain(APP_ENV);
    });

    test("IS_TEST is boolean", () => {
      expect(typeof IS_TEST).toBe("boolean");
    });

    test("IS_PRODUCTION is boolean", () => {
      expect(typeof IS_PRODUCTION).toBe("boolean");
    });

    test("IS_DEVELOPMENT is boolean", () => {
      expect(typeof IS_DEVELOPMENT).toBe("boolean");
    });

    test("BASE_URL is string", () => {
      expect(typeof BASE_URL).toBe("string");
    });

    test("API_URL is string", () => {
      expect(typeof API_URL).toBe("string");
    });

    test("APP_NAME is string", () => {
      expect(typeof APP_NAME).toBe("string");
    });

    test("LOG_LEVEL is valid level", () => {
      expect(["debug", "info", "warn", "error"]).toContain(LOG_LEVEL);
    });

    test("DEBUG_ENABLED is boolean", () => {
      expect(typeof DEBUG_ENABLED).toBe("boolean");
    });
  });
});
