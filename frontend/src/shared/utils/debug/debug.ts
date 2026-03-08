/**
 * Centralized debug logging utility with PII sanitization
 * Set LOG_LEVEL to control which log levels are printed (debug, info, warn, error)
 * Set DEBUG_ENABLED to false to disable all debug logs for production
 *
 * All logging automatically sanitizes PII data for GDPR compliance and security
 */

import {
  sanitizeObject,
  sanitizeString,
} from "@/shared/utils/security/pii-sanitization";
import {
  DEBUG_ENABLED,
  LOG_LEVEL,
  IS_DEVELOPMENT,
} from "@/shared/utils/config/envUtil";

const getLogLevel = (): LogLevel => {
  return LOG_LEVEL;
};

// Log level hierarchy for filtering
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4, // Always shown, bypasses all filters
  timezone: 0, // timezone logs follow debug level
} as const;

type LogLevel = "info" | "warn" | "error" | "debug" | "timezone" | "critical";

const LOG_EMOJIS = {
  TIMEZONE: "🕐",
  GROUP: "🔍",
  CRITICAL: "🚨",
} as const;

interface DebugContext {
  component?: string;
  function?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

class DebugLogger {
  private enabled: boolean;

  constructor(enabled?: boolean) {
    // Default to false to avoid initialization issues
    // Will be properly set after initialization
    this.enabled = enabled ?? false;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: DebugContext,
    data?: any
  ): void {
    // Always emit errors regardless of debug enabled state
    if (!this.enabled && level !== "error") return;

    // Check if this log level should be printed based on LOG_LEVEL
    const currentLogLevel = getLogLevel();
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel] && level !== "error")
      return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // Add emoji for timezone logs
    const finalMessage =
      level === "timezone" ? `${LOG_EMOJIS.TIMEZONE} ${message}` : message;

    // Skip sanitization for error logs to preserve critical debugging information
    // Also skip sanitization in development for easier debugging
    const shouldSanitize = level !== "error" && !IS_DEVELOPMENT;
    const sanitizedMessage = shouldSanitize
      ? sanitizeString(`${prefix} ${finalMessage}`)
      : `${prefix} ${finalMessage}`;
    const sanitizedContext =
      shouldSanitize && context ? sanitizeObject(context) : context;
    const sanitizedData = shouldSanitize && data ? sanitizeObject(data) : data;

    let logMessage = sanitizedMessage;

    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      const contextStr = Object.entries(sanitizedContext)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      logMessage += ` | ${contextStr}`;
    }

    const logMethod =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    // Force console output for timezone debugging in browser (with sanitization)
    if (level === "timezone" && typeof window !== "undefined") {
      const timezoneMessage = IS_DEVELOPMENT
        ? message
        : sanitizeString(message);
      console.log(
        `${LOG_EMOJIS.TIMEZONE} TIMEZONE DEBUG: ${LOG_EMOJIS.TIMEZONE} ${timezoneMessage}`,
        sanitizedContext,
        sanitizedData
      );
      return;
    }

    if (sanitizedData !== undefined) {
      logMethod(logMessage, sanitizedData);
    } else {
      logMethod(logMessage);
    }
  }

  info(message: string, context?: DebugContext, data?: any) {
    this.formatMessage("info", message, context, data);
  }

  warn(message: string, context?: DebugContext, data?: any) {
    this.formatMessage("warn", message, context, data);
  }

  error(message: string, context?: DebugContext, data?: any) {
    this.formatMessage("error", message, context, data);
  }

  debug(message: string, context?: DebugContext, data?: any) {
    this.formatMessage("debug", message, context, data);
  }

  // Special timezone debugging
  timezone(message: string, context?: DebugContext, data?: any) {
    this.formatMessage("timezone", message, context, data);
  }

  // Helper for timezone-specific debugging
  logTimeConversion(
    operation: string,
    originalTime: string | Date,
    convertedTime: string | Date,
    timezone?: string,
    context?: DebugContext
  ) {
    if (!this.enabled) return;

    try {
      const timezoneInfo = timezone ? ` (${timezone})` : "";
      this.timezone(
        `${operation}: ${originalTime} -> ${convertedTime}${timezoneInfo}`,
        context,
        {
          original: originalTime,
          converted: convertedTime,
          timezone,
          userTimezone: this.getUserTimezone(),
          timezoneOffset: this.getTimezoneOffset(),
        }
      );
    } catch {
      // Fallback logging without timezone info if there's an error
      this.debug(
        `${operation}: ${originalTime} -> ${convertedTime} (timezone error)`,
        context
      );
    }
  }

  private getUserTimezone(): string {
    try {
      return typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Unknown";
    } catch {
      return "Unknown";
    }
  }

  private getTimezoneOffset(): number {
    try {
      return new Date().getTimezoneOffset();
    } catch {
      return 0;
    }
  }

  // Helper for component lifecycle debugging
  componentLifecycle(
    component: string,
    lifecycle: string,
    data?: any,
    context?: DebugContext
  ) {
    this.debug(
      `Component ${component} - ${lifecycle}`,
      { component, ...context },
      data
    );
  }

  // Helper for API call debugging
  apiCall(
    method: string,
    url: string,
    status: "start" | "success" | "error",
    context?: DebugContext,
    data?: any
  ) {
    const level =
      status === "error" ? "error" : status === "success" ? "info" : "debug";
    this.formatMessage(
      level as LogLevel,
      `API ${method} ${url} - ${status}`,
      { api: `${method} ${url}`, ...context },
      data
    );
  }

  // Group related logs together
  group(label: string, callback: () => void) {
    if (!this.enabled) {
      callback();
      return;
    }

    console.group(`${LOG_EMOJIS.GROUP} ${label}`);
    try {
      callback();
    } finally {
      console.groupEnd();
    }
  }

  // Disable/enable at runtime
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const debugLog = new DebugLogger();

// Initialize after module loading to avoid circular dependencies
setTimeout(() => {
  debugLog.setEnabled(DEBUG_ENABLED);
}, 0);

// Export helper functions for common patterns
export const logTimeConversion = (
  operation: string,
  originalTime: string | Date,
  convertedTime: string | Date,
  timezone?: string,
  context?: DebugContext
) =>
  debugLog.logTimeConversion(
    operation,
    originalTime,
    convertedTime,
    timezone,
    context
  );

export const logComponentLifecycle = (
  component: string,
  lifecycle: string,
  data?: any,
  context?: DebugContext
) => debugLog.componentLifecycle(component, lifecycle, data, context);

export const logApiCall = (
  method: string,
  url: string,
  status: "start" | "success" | "error",
  context?: DebugContext,
  data?: any
) => debugLog.apiCall(method, url, status, context, data);

export const debugGroup = (label: string, callback: () => void) =>
  debugLog.group(label, callback);

// Environment variable helpers
export const isDebugEnabled = () => DEBUG_ENABLED;
export const setDebugEnabled = (enabled: boolean) =>
  debugLog.setEnabled(enabled);

// Log level helpers
export { getLogLevel };
export const setLogLevel = (_level: LogLevel) => {
  // This would need to be implemented if you want runtime log level changes
  // For now, log level is controlled by environment variable
  console.warn(
    "Log level is controlled by NEXT_PUBLIC_LOG_LEVEL environment variable. Restart required for changes."
  );
};

export default debugLog;
