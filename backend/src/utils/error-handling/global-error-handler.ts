/**
 * Global Error Handler for Production Stability
 * Handles unhandled promise rejections and uncaught exceptions
 * to prevent process crashes and ensure reliable operation
 */

import debugLog from "@/utils/debug/debug";
import { APP_ENV } from "@/utils/config/envUtil";

// Declare window global for server-side environment detection
declare const window: undefined | object;

// metrics.ts uses prom-client which requires Node.js built-ins (fs, v8, cluster).
// We must NOT statically import it here because this file is transitively
// imported by client components (safe-fetch → authenticated-fetch → app-context).
// Dynamic imports are tree-shaken from the browser bundle by Next.js/Turbopack.
async function recordErrorMetric(category: string, severity: string) {
  if (typeof window !== "undefined") return;
  const { recordError } = await import("@/services/observability/metrics");
  recordError(category, severity);
}
async function recordUnhandledRejectionMetric() {
  if (typeof window !== "undefined") return;
  const { recordUnhandledRejection } =
    await import("@/services/observability/metrics");
  recordUnhandledRejection();
}
async function recordUncaughtExceptionMetric() {
  if (typeof window !== "undefined") return;
  const { recordUncaughtException } =
    await import("@/services/observability/metrics");
  recordUncaughtException();
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Error categories for better classification
export enum ErrorCategory {
  DATABASE = "database",
  EXTERNAL_API = "external_api",
  AUTHENTICATION = "authentication",
  VALIDATION = "validation",
  RATE_LIMIT = "rate_limit",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

interface ErrorContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: Date;
  stackTrace?: string;
  additionalData?: Record<string, unknown>;
}

interface StructuredError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  originalError?: Error;
  isRecoverable: boolean;
}

// In-memory error tracking for monitoring
const errorMetrics = {
  unhandledRejections: 0,
  uncaughtExceptions: 0,
  lastErrorTime: null as Date | null,
  errorsByCategory: new Map<ErrorCategory, number>(),
  errorsBySeverity: new Map<ErrorSeverity, number>(),
};

/**
 * Categorizes errors based on their message and type
 */
function categorizeError(error: Error): ErrorCategory {
  const message = (error.message || "").toLowerCase();
  const _stack = error.stack?.toLowerCase() || "";

  // Database errors (check first - most specific)
  if (
    message.includes("database") ||
    (message.includes("connection") && message.includes("pool"))
  ) {
    return ErrorCategory.DATABASE;
  }

  // External API errors (including ECONNREFUSED and fetch)
  if (
    message.includes("econnrefused") ||
    message.includes("connection refused") ||
    message.includes("fetch") ||
    (message.includes("timeout") && !message.includes("database"))
  ) {
    return ErrorCategory.EXTERNAL_API;
  }

  // Network-specific errors (more general network issues)
  if (
    message.includes("connection reset") ||
    message.includes("dns") ||
    (message.includes("network") && !message.includes("database"))
  ) {
    return ErrorCategory.NETWORK;
  }

  if (
    message.includes("auth") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("token")
  ) {
    return ErrorCategory.AUTHENTICATION;
  }

  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("schema")
  ) {
    return ErrorCategory.VALIDATION;
  }

  if (message.includes("rate limit") || message.includes("too many requests")) {
    return ErrorCategory.RATE_LIMIT;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Determines error severity based on type and impact
 */
function determineErrorSeverity(
  error: Error,
  category: ErrorCategory,
): ErrorSeverity {
  const message = (error.message || "").toLowerCase();

  // Critical errors that require immediate attention
  if (
    message.includes("out of memory") ||
    message.includes("stack overflow") ||
    message.includes("maximum call stack") ||
    message.includes("segmentation fault") ||
    (category === ErrorCategory.DATABASE && message.includes("connection pool"))
  ) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity errors that impact functionality
  if (
    category === ErrorCategory.DATABASE ||
    category === ErrorCategory.AUTHENTICATION ||
    message.includes("crash") ||
    message.includes("fatal")
  ) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity for external service issues
  if (
    category === ErrorCategory.EXTERNAL_API ||
    category === ErrorCategory.NETWORK ||
    category === ErrorCategory.RATE_LIMIT
  ) {
    return ErrorSeverity.MEDIUM;
  }

  // Low severity for validation and other recoverable errors
  return ErrorSeverity.LOW;
}

/**
 * Checks if an error is recoverable
 */
function isErrorRecoverable(error: Error, category: ErrorCategory): boolean {
  const message = (error.message || "").toLowerCase();

  // Non-recoverable errors
  if (
    message.includes("out of memory") ||
    message.includes("stack overflow") ||
    message.includes("maximum call stack") ||
    message.includes("segmentation fault")
  ) {
    return false;
  }

  // Database connection issues might be recoverable
  if (category === ErrorCategory.DATABASE) {
    return (
      message.includes("timeout") ||
      message.includes("connection") ||
      message.includes("pool")
    );
  }

  // Most other errors are potentially recoverable
  return category !== ErrorCategory.UNKNOWN;
}

/**
 * Generates a unique error ID for tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Structures error information for consistent logging
 */
function structureError(
  error: Error,
  context: Partial<ErrorContext> = {},
  _source: "unhandledRejection" | "uncaughtException" | "manual" = "manual",
): StructuredError {
  const category = categorizeError(error);
  const severity = determineErrorSeverity(error, category);
  const recoverable = isErrorRecoverable(error, category);

  const structuredError: StructuredError = {
    id: generateErrorId(),
    message:
      error.message === null
        ? "null"
        : error.message === undefined
          ? "undefined"
          : error.message,
    category,
    severity,
    context: {
      timestamp: new Date(),
      stackTrace: error.stack,
      ...context,
    },
    originalError: error,
    isRecoverable: recoverable,
  };

  // Update metrics
  errorMetrics.lastErrorTime = new Date();
  errorMetrics.errorsByCategory.set(
    category,
    (errorMetrics.errorsByCategory.get(category) || 0) + 1,
  );
  errorMetrics.errorsBySeverity.set(
    severity,
    (errorMetrics.errorsBySeverity.get(severity) || 0) + 1,
  );

  recordErrorMetric(category, severity);

  return structuredError;
}

/**
 * Logs structured error information
 */
function logStructuredError(structuredError: StructuredError, source: string) {
  const logLevel =
    structuredError.severity === ErrorSeverity.CRITICAL
      ? "error"
      : structuredError.severity === ErrorSeverity.HIGH
        ? "error"
        : structuredError.severity === ErrorSeverity.MEDIUM
          ? "warn"
          : "info";

  debugLog[logLevel](
    `${source}: ${structuredError.message}`,
    {
      service: "global-error-handler",
      operation: source,
    },
    {
      errorId: structuredError.id,
      category: structuredError.category,
      severity: structuredError.severity,
      recoverable: structuredError.isRecoverable,
      context: structuredError.context,
    },
  );
}

/**
 * Handles unhandled promise rejections
 */
function handleUnhandledRejection(reason: any, promise: Promise<any>) {
  errorMetrics.unhandledRejections++;
  recordUnhandledRejectionMetric();

  // Convert reason to Error if it's not already
  const error = reason instanceof Error ? reason : new Error(String(reason));

  const structuredError = structureError(error, {
    additionalData: { promise: promise.toString() },
  });

  logStructuredError(structuredError, "unhandledRejection");

  // For critical errors, we might need to restart the process
  if (
    structuredError.severity === ErrorSeverity.CRITICAL &&
    !structuredError.isRecoverable
  ) {
    debugLog.error(
      "Critical unrecoverable error detected, initiating graceful shutdown",
      {
        service: "global-error-handler",
        operation: "critical-error-shutdown",
      },
      { errorId: structuredError.id },
    );

    // Give some time for logging before shutdown
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }
}

/**
 * Handles uncaught exceptions
 */
function handleUncaughtException(error: Error) {
  errorMetrics.uncaughtExceptions++;
  recordUncaughtExceptionMetric();

  const structuredError = structureError(error);
  logStructuredError(structuredError, "uncaughtException");

  // Uncaught exceptions are always serious - we should exit gracefully
  debugLog.error(
    "Uncaught exception detected, initiating graceful shutdown",
    {
      service: "global-error-handler",
      operation: "uncaught-exception-shutdown",
    },
    { errorId: structuredError.id },
  );

  // Give some time for cleanup and logging
  setTimeout(() => {
    process.exit(1);
  }, 5000);
}

/**
 * Handles process warning events
 */
function handleProcessWarning(warning: any) {
  debugLog.warn(
    "Process warning detected",
    {
      service: "global-error-handler",
      operation: "process-warning",
    },
    {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    },
  );
}

/**
 * Installs global error handlers
 */
/**
 * Installs global error handlers
 */
export function installGlobalErrorHandlers() {
  // Server-side only check
  if (typeof window !== "undefined") {
    return;
  }

  // Only install once
  if (
    process.listenerCount &&
    process.listenerCount("unhandledRejection") > 0
  ) {
    return;
  }

  process.on("unhandledRejection", handleUnhandledRejection);
  process.on("uncaughtException", handleUncaughtException);
  process.on("warning", handleProcessWarning);

  debugLog.info("Global error handlers installed", {
    service: "global-error-handler",
    operation: "install",
  });
}

/**
 * Removes global error handlers (for testing)
 */
export function removeGlobalErrorHandlers() {
  if (typeof window !== "undefined") {
    return;
  }

  process.removeListener("unhandledRejection", handleUnhandledRejection);
  process.removeListener("uncaughtException", handleUncaughtException);
  process.removeListener("warning", handleProcessWarning);

  debugLog.info("Global error handlers removed", {
    service: "global-error-handler",
    operation: "remove",
  });
}

/**
 * Manual error reporting for custom error handling
 */
export function reportError(error: Error, context: Partial<ErrorContext> = {}) {
  const structuredError = structureError(error, context, "manual");
  logStructuredError(structuredError, "manual-report");
  return structuredError;
}

/**
 * Gets error metrics for monitoring
 */
export function getErrorMetrics() {
  return {
    ...errorMetrics,
    errorsByCategory: Object.fromEntries(errorMetrics.errorsByCategory),
    errorsBySeverity: Object.fromEntries(errorMetrics.errorsBySeverity),
  };
}

/**
 * Resets error metrics (for testing)
 */
export function resetErrorMetrics() {
  errorMetrics.unhandledRejections = 0;
  errorMetrics.uncaughtExceptions = 0;
  errorMetrics.lastErrorTime = null;
  errorMetrics.errorsByCategory.clear();
  errorMetrics.errorsBySeverity.clear();
}

/**
 * Utility for wrapping async functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: Partial<ErrorContext> = {},
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const _structuredError = reportError(error as Error, context);

      // Re-throw the error so the caller can handle it appropriately
      throw error;
    }
  }) as T;
}

/**
 * Timeout wrapper for promises to prevent hanging
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "Operation timed out",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let isResolved = false;

    // Set up timeout first to ensure it gets priority in tests where setTimeout is mocked
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`${errorMessage} after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Then handle the promise
    promise
      .then((value) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve(value);
        }
      })
      .catch((error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      });
  });
}

// Auto-install handlers in production (server-side only)
if (APP_ENV === "production" && typeof window === "undefined") {
  installGlobalErrorHandlers();
}
