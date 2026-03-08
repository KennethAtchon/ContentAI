/**
 * System Logger - Always-on logging for production monitoring
 *
 * This logger bypasses all debug/development filters and is designed for:
 * - System health monitoring
 * - Performance alerts
 * - Security events
 * - Infrastructure monitoring
 * - Critical system events
 *
 * These logs are ALWAYS printed regardless of DEBUG_ENABLED or LOG_LEVEL settings
 */

import {
  sanitizeObject,
  sanitizeString,
} from "@/shared/utils/security/pii-sanitization";
import { IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";

type SystemLogLevel = "info" | "warn" | "error" | "critical";

interface SystemContext {
  service: string;
  operation: string;
  [key: string]: unknown;
}

class SystemLogger {
  private formatSystemMessage(
    level: SystemLogLevel,
    message: string,
    context: SystemContext,
    data?: unknown
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // Add critical emoji for critical logs
    const finalMessage = level === "critical" ? `🚨 ${message}` : message;

    // Sanitize for PII but always log
    // In development, skip sanitization for easier debugging
    const shouldSanitize = !IS_DEVELOPMENT;
    const sanitizedMessage = shouldSanitize
      ? sanitizeString(`${prefix} ${finalMessage}`)
      : `${prefix} ${finalMessage}`;
    const sanitizedContext = shouldSanitize ? sanitizeObject(context) : context;
    const sanitizedData = shouldSanitize && data ? sanitizeObject(data) : data;

    let logMessage = sanitizedMessage;

    // Format context as key=value pairs
    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      const contextStr = Object.entries(sanitizedContext)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      logMessage += ` | ${contextStr}`;
    }

    // Choose appropriate console method
    const logMethod =
      level === "error" || level === "critical"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    // Always log to console regardless of environment
    if (sanitizedData !== undefined) {
      logMethod(logMessage, sanitizedData);
    } else {
      logMethod(logMessage);
    }
  }

  /**
   * System info logs - general system information
   */
  info(message: string, context: SystemContext, data?: unknown) {
    this.formatSystemMessage("info", message, context, data);
  }

  /**
   * System warnings - performance issues, high resource usage, etc.
   */
  warn(message: string, context: SystemContext, data?: unknown) {
    this.formatSystemMessage("warn", message, context, data);
  }

  /**
   * System errors - service failures, connection issues, etc.
   */
  error(message: string, context: SystemContext, data?: unknown) {
    this.formatSystemMessage("error", message, context, data);
  }

  /**
   * Critical system events - security issues, data corruption, etc.
   */
  critical(message: string, context: SystemContext, data?: unknown) {
    this.formatSystemMessage("critical", message, context, data);
  }

  /**
   * Memory monitoring logs
   */
  memory(message: string, operation: string, data: unknown) {
    this.warn(
      message,
      {
        service: "app-monitoring",
        operation: `memory-${operation}`,
      },
      data
    );
  }

  /**
   * Redis monitoring logs
   */
  redis(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: unknown
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "redis-monitoring",
        operation,
      },
      data
    );
  }

  /**
   * Database monitoring logs
   */
  database(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: unknown
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "database-monitoring",
        operation,
      },
      data
    );
  }

  /**
   * Security event logs
   */
  security(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: unknown
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "security",
        operation,
      },
      data
    );
  }

  /**
   * Rate limiting logs
   */
  rateLimit(message: string, operation: string, data?: unknown) {
    this.warn(
      message,
      {
        service: "rate-limiting",
        operation,
      },
      data
    );
  }

  /**
   * Authentication/authorization logs
   */
  auth(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: unknown
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "authentication",
        operation,
      },
      data
    );
  }

  /**
   * CSRF protection logs
   */
  csrf(message: string, operation: string, data?: unknown) {
    this.warn(
      message,
      {
        service: "csrf-protection",
        operation,
      },
      data
    );
  }

  /**
   * Performance monitoring logs
   */
  performance(message: string, operation: string, data?: unknown) {
    this.info(
      message,
      {
        service: "performance-monitoring",
        operation,
      },
      data
    );
  }

  /**
   * Startup/shutdown logs
   */
  lifecycle(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: unknown
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "app-lifecycle",
        operation,
      },
      data
    );
  }
}

// Export singleton instance
export const systemLogger = new SystemLogger();

// Convenience exports for common use cases
export const logSystemMemory = (
  message: string,
  operation: string,
  data: unknown
) => systemLogger.memory(message, operation, data);

export const logRedisEvent = (
  level: SystemLogLevel,
  message: string,
  operation: string,
  data?: unknown
) => systemLogger.redis(level, message, operation, data);

export const logSecurityEvent = (
  level: SystemLogLevel,
  message: string,
  operation: string,
  data?: unknown
) => systemLogger.security(level, message, operation, data);

export const logAuthEvent = (
  level: SystemLogLevel,
  message: string,
  operation: string,
  data?: unknown
) => systemLogger.auth(level, message, operation, data);

export const logPerformanceEvent = (
  message: string,
  operation: string,
  data?: unknown
) => systemLogger.performance(message, operation, data);

export default systemLogger;
