/**
 * Global Error Handler
 * Client-side error utilities: structured error reporting, timeouts, error wrapping.
 * Server-side process handlers (unhandledRejection, uncaughtException) live in the backend.
 */

import debugLog from "@/shared/debug/debug";

// No-ops replacing the removed server-side metric recording
function recordErrorMetric(): void {}

// Error severity levels (used internally)
export enum ErrorSeverity {
  LOW = "low",

  MEDIUM = "medium",

  HIGH = "high",

  CRITICAL = "critical",
}

// Error categories for better classification (used internally)
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
  sessionId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: Date;
  [key: string]: unknown;
}

interface StructuredError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  originalError: Error;
  isRecoverable: boolean;
}

// Error metrics tracking
const errorMetrics = {
  totalErrors: 0,
  lastErrorTime: new Date(),
  errorsByCategory: new Map<ErrorCategory, number>(),
  errorsBySeverity: new Map<ErrorSeverity, number>(),
};

/**
 * Categorizes errors based on message and stack trace
 */
function categorizeError(error: Error): ErrorCategory {
  const message = (error.message || "").toLowerCase();
  const stack = (error.stack || "").toLowerCase();

  // Database errors (check first - most specific)
  if (
    message.includes("database") ||
    (message.includes("connection") && message.includes("pool")) ||
    message.includes("drizzle") ||
    stack.includes("drizzle")
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
  category: ErrorCategory
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

  // Network errors might be recoverable
  if (
    category === ErrorCategory.NETWORK ||
    category === ErrorCategory.EXTERNAL_API
  ) {
    return true;
  }

  // Validation errors are recoverable
  if (category === ErrorCategory.VALIDATION) {
    return true;
  }

  return false;
}

function generateErrorId(): string {
  return `err_${crypto.randomUUID()}`;
}

/**
 * Structures error information for consistent logging
 */
function structureError(
  error: Error,
  context: Partial<ErrorContext> = {}
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
    (errorMetrics.errorsByCategory.get(category) || 0) + 1
  );
  errorMetrics.errorsBySeverity.set(
    severity,
    (errorMetrics.errorsBySeverity.get(severity) || 0) + 1
  );

  recordErrorMetric();

  return structuredError;
}

/**
 * Logs structured error information
 */
function logStructuredError(
  structuredError: StructuredError,
  source: string
): void {
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
    }
  );
}

/**
 * Manual error reporting for custom error handling
 */
export function reportError(
  error: Error,
  context: Partial<ErrorContext> = {}
): StructuredError {
  const structuredError = structureError(error, context);
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
 * Clears error metrics (useful for testing)
 */
export function clearErrorMetrics(): void {
  errorMetrics.totalErrors = 0;
  errorMetrics.lastErrorTime = new Date();
  errorMetrics.errorsByCategory.clear();
  errorMetrics.errorsBySeverity.clear();
}

/**
 * Utility for wrapping async functions with error handling
 */
export function withErrorHandling<
  T extends (...args: any[]) => Promise<unknown>,
>(fn: T, context: Partial<ErrorContext> = {}): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Error reported but result unused
      reportError(error as Error, context);

      // Re-throw the error so the caller can handle it appropriately
      throw error;
    }
  }) as T;
}

/**
 * Creates a timeout promise that rejects with a structured error
 */
export function createTimeoutError(
  timeoutMs: number,
  operation: string
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(
        `Operation timed out after ${timeoutMs}ms: ${operation}`
      );
      reject(reportError(error, { operation }));
    }, timeoutMs);
  });
}

/**
 * Wraps a promise with timeout and error handling
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  try {
    return await Promise.race([
      promise,
      createTimeoutError(timeoutMs, operation),
    ]);
  } catch (error) {
    if (error instanceof Error) {
      throw reportError(error, { operation });
    }
    throw error;
  }
}

export default {
  reportError,
  getErrorMetrics,
  clearErrorMetrics,
  withErrorHandling,
  createTimeoutError,
  withTimeout,
};
