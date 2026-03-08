/**
 * API Route Error Wrapper
 *
 * Provides standardized error handling and timeout wrapping for API routes.
 *
 * Division of responsibility:
 * - `withStandardErrorHandling` — adds timeout + request logging around a handler.
 *   Used by routes that need extra resilience (e.g. health/error-monitoring).
 * - `withApiProtection` (api-route-protection.ts) — the primary HOF for all other
 *   routes; handles auth, CSRF, rate limiting, CORS, and validation.
 *
 * NOTE: `createErrorResponse` was previously duplicated here with a different
 * signature and response shape. It has been removed — use the canonical version
 * from `@/utils/api/response-helpers` instead.
 */

import { reportError, withTimeout } from "./global-error-handler";
import debugLog from "@/utils/debug/debug";

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
import {
  createErrorResponse,
  createInternalErrorResponse,
} from "@/utils/api/response-helpers";

// Re-export HTTP status constants so callers don't need a separate import
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export const ERROR_MESSAGES = {
  INTERNAL_ERROR: "An internal server error occurred",
  INVALID_REQUEST: "Invalid request data",
  UNAUTHORIZED: "Authentication required",
  FORBIDDEN: "Access denied",
  NOT_FOUND: "Resource not found",
  METHOD_NOT_ALLOWED: "Method not allowed",
  RATE_LIMITED: "Rate limit exceeded",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  TIMEOUT: "Request timeout",
  DATABASE_ERROR: "Database operation failed",
  EXTERNAL_SERVICE_ERROR: "External service error",
} as const;

type ApiHandler = (request: Request, context?: any) => Promise<Response>;

/**
 * Optional hook to intercept errors before default classification.
 * Return a `Response` to short-circuit the default handler, or `null`
 * to fall through to the standard `classifyAndRespond` logic.
 */
type CustomErrorHandler = (error: Error) => Response | null;

/**
 * Wraps an API route handler with request logging, timeout enforcement,
 * and error classification. The caught error is classified by message
 * keywords and mapped to an appropriate HTTP status.
 *
 * For most routes, prefer `withApiProtection` (api-route-protection.ts).
 * Use this wrapper for routes that need explicit timeout control or custom
 * error logging without the full protection stack.
 */
export function withApiErrorHandling(
  handler: ApiHandler,
  options: {
    timeoutMs?: number;
    allowedMethods?: string[];
    /** Called before default error classification. Return a response to override, or null to use defaults. */
    customErrorHandler?: CustomErrorHandler;
  } = {},
): ApiHandler {
  const { timeoutMs = 30000, allowedMethods, customErrorHandler } = options;

  return async (request: Request, context?: any): Promise<Response> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const startTime = Date.now();

    debugLog.info(
      "API request started",
      { service: "api-wrapper", operation: "request-start" },
      {
        requestId,
        method: request.method,
        url: request.url,
        userAgent: request.headers.get("user-agent"),
        ip: getClientIp(request),
      },
    );

    try {
      if (allowedMethods && !allowedMethods.includes(request.method)) {
        return Response.json(
          {
            error: ERROR_MESSAGES.METHOD_NOT_ALLOWED,
            code: "METHOD_NOT_ALLOWED",
            allowedMethods,
          },
          { status: 405 },
        );
      }

      const response = await withTimeout(
        handler(request, context),
        timeoutMs,
        "API request timeout",
      );

      const duration = Date.now() - startTime;
      debugLog.info(
        "API request completed",
        { service: "api-wrapper", operation: "request-success" },
        {
          requestId,
          method: request.method,
          statusCode: response.status,
          duration,
        },
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      const structuredError = reportError(err, {
        requestId,
        path: new URL(request.url).pathname,
        method: request.method,
        userAgent: request.headers.get("user-agent") || undefined,
        ip: getClientIp(request),
      });

      debugLog.error(
        "API request failed",
        { service: "api-wrapper", operation: "request-error" },
        {
          requestId,
          duration,
          errorId: structuredError?.id,
          error: err.message,
          stack: err.stack,
        },
      );

      if (customErrorHandler) {
        const customResponse = customErrorHandler(err);
        if (customResponse !== null) return customResponse;
      }

      return classifyAndRespond(err);
    }
  };
}

/**
 * Maps an error to an appropriate HTTP response based on its message.
 * Uses the canonical `createErrorResponse` from response-helpers.
 */
function classifyAndRespond(error: Error): Response {
  const message = error.message.toLowerCase();

  if (message.includes("database") || message.includes("connection pool")) {
    return createErrorResponse(
      ERROR_MESSAGES.DATABASE_ERROR,
      503,
      "DATABASE_ERROR",
    );
  }
  if (message.includes("unauthorized") || message.includes("auth")) {
    return createErrorResponse(
      ERROR_MESSAGES.UNAUTHORIZED,
      401,
      "UNAUTHORIZED",
    );
  }
  if (message.includes("forbidden") || message.includes("access denied")) {
    return createErrorResponse(ERROR_MESSAGES.FORBIDDEN, 403, "FORBIDDEN");
  }
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("schema")
  ) {
    return createErrorResponse(error.message, 400, "VALIDATION_ERROR");
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return createErrorResponse(
      ERROR_MESSAGES.RATE_LIMITED,
      429,
      "RATE_LIMITED",
    );
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return createErrorResponse(ERROR_MESSAGES.TIMEOUT, 504, "TIMEOUT");
  }
  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("external") ||
    message.includes("api")
  ) {
    return createErrorResponse(
      ERROR_MESSAGES.EXTERNAL_SERVICE_ERROR,
      502,
      "EXTERNAL_SERVICE_ERROR",
    );
  }
  if (message.includes("not found") || message.includes("does not exist")) {
    return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, 404, "NOT_FOUND");
  }

  return createInternalErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
}

/**
 * Convenience wrapper: adds logging + 30s timeout to any handler.
 * Used by health/error-monitoring — for all other routes use `withApiProtection`.
 */
export function withStandardErrorHandling(handler: ApiHandler): ApiHandler {
  return withApiErrorHandling(handler, {
    timeoutMs: 30000,
  });
}

/**
 * Utility for running async operations with a timeout and automatic error
 * reporting. Useful for non-request code paths (background jobs, etc.).
 */
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  context: string,
  timeoutMs: number = 10000,
): Promise<T> {
  try {
    return await withTimeout(operation(), timeoutMs, `${context} timeout`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    reportError(err, { additionalData: { context } });
    throw err;
  }
}

export { withTimeout, reportError };
