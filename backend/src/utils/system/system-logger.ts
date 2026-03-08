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
} from "@/utils/security/pii-sanitization";
import { IS_DEVELOPMENT } from "@/utils/config/envUtil";

type SystemLogLevel = "info" | "warn" | "error" | "critical";

interface SystemContext {
  service: string;
  operation: string;
  [key: string]: any;
}

class SystemLogger {
  private formatSystemMessage(
    level: SystemLogLevel,
    message: string,
    context: SystemContext,
    data?: any,
  ): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    const finalMessage = level === "critical" ? `🚨 ${message}` : message;

    const shouldSanitize = !IS_DEVELOPMENT;
    const sanitizedMessage = shouldSanitize
      ? sanitizeString(`${prefix} ${finalMessage}`)
      : `${prefix} ${finalMessage}`;
    const sanitizedContext = shouldSanitize ? sanitizeObject(context) : context;
    const sanitizedData = shouldSanitize && data ? sanitizeObject(data) : data;

    let logMessage = sanitizedMessage;
    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      const contextStr = Object.entries(sanitizedContext)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      logMessage += ` | ${contextStr}`;
    }

    const logMethod =
      level === "error" || level === "critical"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    if (sanitizedData !== undefined) {
      logMethod(logMessage, sanitizedData);
    } else {
      logMethod(logMessage);
    }
  }

  info(message: string, context: SystemContext, data?: any) {
    this.formatSystemMessage("info", message, context, data);
  }

  warn(message: string, context: SystemContext, data?: any) {
    this.formatSystemMessage("warn", message, context, data);
  }

  error(message: string, context: SystemContext, data?: any) {
    this.formatSystemMessage("error", message, context, data);
  }

  critical(message: string, context: SystemContext, data?: any) {
    this.formatSystemMessage("critical", message, context, data);
  }

  memory(message: string, operation: string, data: any) {
    this.warn(
      message,
      {
        service: "app-monitoring",
        operation: `memory-${operation}`,
      },
      data,
    );
  }

  redis(level: SystemLogLevel, message: string, operation: string, data?: any) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "redis-monitoring",
        operation,
      },
      data,
    );
  }

  database(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: any,
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "database-monitoring",
        operation,
      },
      data,
    );
  }

  security(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: any,
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "security",
        operation,
      },
      data,
    );
  }

  rateLimit(message: string, operation: string, data?: any) {
    this.warn(
      message,
      {
        service: "rate-limiting",
        operation,
      },
      data,
    );
  }

  auth(level: SystemLogLevel, message: string, operation: string, data?: any) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "authentication",
        operation,
      },
      data,
    );
  }

  csrf(message: string, operation: string, data?: any) {
    this.warn(
      message,
      {
        service: "csrf-protection",
        operation,
      },
      data,
    );
  }

  performance(message: string, operation: string, data?: any) {
    this.info(
      message,
      {
        service: "performance-monitoring",
        operation,
      },
      data,
    );
  }

  lifecycle(
    level: SystemLogLevel,
    message: string,
    operation: string,
    data?: any,
  ) {
    this.formatSystemMessage(
      level,
      message,
      {
        service: "app-lifecycle",
        operation,
      },
      data,
    );
  }
}

export const systemLogger = new SystemLogger();

export const logSystemMemory = (
  message: string,
  operation: string,
  data: any,
) => systemLogger.memory(message, operation, data);

export const logRedisEvent = (
  level: SystemLogLevel,
  message: string,
  operation: string,
  data?: any,
) => systemLogger.redis(level, message, operation, data);

export const logSecurityEvent = (
  level: SystemLogLevel,
  message: string,
  operation: string,
  data?: any,
) => systemLogger.security(level, message, operation, data);

export const logAuthEvent = (
  level: SystemLogLevel,
  message: string,
  operation: string,
  data?: any,
) => systemLogger.auth(level, message, operation, data);

export const logPerformanceEvent = (
  message: string,
  operation: string,
  data?: any,
) => systemLogger.performance(message, operation, data);

export default systemLogger;
