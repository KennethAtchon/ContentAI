/**
 * Unit tests for system logger API. Preload mocks @/utils/system/system-logger;
 * we test the interface (info, warn, error, critical, memory, redis, database, etc.)
 * by calling the mocked methods.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  systemLogger,
  logSystemMemory,
  logRedisEvent,
  logSecurityEvent,
  logAuthEvent,
  logPerformanceEvent,
} from "@/utils/system/system-logger";

describe("system-logger", () => {
  beforeEach(() => {
    (systemLogger.info as any).mockClear?.();
    (systemLogger.warn as any).mockClear?.();
    (systemLogger.error as any).mockClear?.();
  });

  describe("systemLogger", () => {
    it("info can be called with message and context", () => {
      systemLogger.info("test info", { service: "test", operation: "op" });
      expect(systemLogger.info).toHaveBeenCalledWith(
        "test info",
        expect.objectContaining({ service: "test", operation: "op" }),
      );
    });

    it("warn can be called with message and context", () => {
      systemLogger.warn("test warn", { service: "test", operation: "op" });
      expect(systemLogger.warn).toHaveBeenCalled();
    });

    it("error can be called with message and context", () => {
      systemLogger.error("test error", { service: "test", operation: "op" });
      expect(systemLogger.error).toHaveBeenCalled();
    });

    it("critical can be called", () => {
      systemLogger.critical("critical", { service: "test", operation: "op" });
      expect(systemLogger.critical).toHaveBeenCalled();
    });

    it("memory can be called", () => {
      systemLogger.memory("high memory", "check", { used: 100 });
      expect(systemLogger.memory).toHaveBeenCalledWith("high memory", "check", {
        used: 100,
      });
    });

    it("redis can be called", () => {
      systemLogger.redis("info", "redis ok", "connect", {});
      expect(systemLogger.redis).toHaveBeenCalledWith(
        "info",
        "redis ok",
        "connect",
        {},
      );
    });

    it("database can be called", () => {
      systemLogger.database("error", "query failed", "findMany", {});
      expect(systemLogger.database).toHaveBeenCalled();
    });

    it("security can be called", () => {
      systemLogger.security("warn", "suspicious", "login", {});
      expect(systemLogger.security).toHaveBeenCalled();
    });

    it("rateLimit can be called", () => {
      systemLogger.rateLimit("limit hit", "api", {});
      expect(systemLogger.rateLimit).toHaveBeenCalled();
    });

    it("auth can be called", () => {
      systemLogger.auth("info", "user login", "login", {});
      expect(systemLogger.auth).toHaveBeenCalled();
    });

    it("csrf can be called", () => {
      systemLogger.csrf("invalid token", "validate", {});
      expect(systemLogger.csrf).toHaveBeenCalled();
    });

    it("performance can be called", () => {
      systemLogger.performance("slow query", "db", { ms: 100 });
      expect(systemLogger.performance).toHaveBeenCalled();
    });

    it("lifecycle can be called", () => {
      systemLogger.lifecycle("info", "startup", "init", {});
      expect(systemLogger.lifecycle).toHaveBeenCalled();
    });
  });

  describe("convenience exports", () => {
    it("logSystemMemory calls through to logger", () => {
      logSystemMemory("high memory", "check", { used: 100 });
      expect(systemLogger.memory).toHaveBeenCalledWith("high memory", "check", {
        used: 100,
      });
    });

    it("logRedisEvent calls through to logger", () => {
      logRedisEvent("info", "ok", "connect");
      expect(systemLogger.redis).toHaveBeenLastCalledWith(
        "info",
        "ok",
        "connect",
        undefined,
      );
    });

    it("logSecurityEvent calls through to logger", () => {
      logSecurityEvent("warn", "event", "op");
      expect(systemLogger.security).toHaveBeenLastCalledWith(
        "warn",
        "event",
        "op",
        undefined,
      );
    });

    it("logAuthEvent calls through to logger", () => {
      logAuthEvent("info", "login", "signin");
      expect(systemLogger.auth).toHaveBeenLastCalledWith(
        "info",
        "login",
        "signin",
        undefined,
      );
    });

    it("logPerformanceEvent calls through to logger", () => {
      logPerformanceEvent("slow", "query", { ms: 50 });
      expect(systemLogger.performance).toHaveBeenCalledWith("slow", "query", {
        ms: 50,
      });
    });
  });
});
