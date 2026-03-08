/**
 * API Response Helpers
 *
 * Utilities for creating standardized API responses.
 * Ensures consistency across all API routes.
 *
 * ## Response Standardization Pattern
 *
 * **Backend (API Routes):** Use `createSuccessResponse` to wrap data
 * ```typescript
 * return createSuccessResponse({ id: '123', name: 'John' });
 * // Returns: { data: { id: '123', name: 'John' } }
 * ```
 *
 * **Frontend (Client Code):** Use `authenticatedFetchJson` for auto-unwrapping
 * ```typescript
 * const user = await authenticatedFetchJson<User>('/api/users/123');
 * // Receives: { id: '123', name: 'John' } (unwrapped automatically)
 * ```
 *
 * This pattern provides:
 * - ✅ Consistent API response structure across all routes
 * - ✅ Clean client code (no manual .data access needed)
 * - ✅ Type safety (TypeScript knows the unwrapped type)
 * - ✅ Backward compatibility (system APIs with custom formats pass through)
 *
 * ⚠️ IMPORTANT: API responses DO NOT use translations (next-intl)
 *
 * Design rationale:
 * - API error messages are intentionally in English for consistency
 * - Client-side code handles translation of user-facing messages
 * - HTTP status codes + error codes are the primary communication
 * - This follows REST API best practices where APIs are locale-agnostic
 * - Backend-to-backend communication should be language-independent
 *
 * Pattern for client-side translation:
 * 1. API returns: { error: "User not found", code: "NOT_FOUND" }
 * 2. Client catches error and translates: t("errors_user_not_found")
 * 3. User sees message in their preferred language
 *
 * DO NOT import or use next-intl in API routes.
 */

import {
  sanitizeObject,
  sanitizeString,
} from "@/utils/security/pii-sanitization";

/**
 * Standard API response structure
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * Standard API error response structure
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedApiResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Create a successful API response
 *
 * @param data - The response data
 * @param meta - Optional metadata
 * @param status - HTTP status code (default: 200)
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200,
): Response {
  return Response.json(
    {
      data,
      ...(meta && { meta: { ...meta, timestamp: new Date().toISOString() } }),
    },
    { status },
  );
}

/**
 * Create a paginated API response
 *
 * @param data - Array of items
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items
 * @param status - HTTP status code (default: 200)
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  status: number = 200,
): Response {
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  return Response.json(
    {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: skip + data.length < total,
      },
    },
    { status },
  );
}

/**
 * Create an error API response
 *
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @param code - Optional error code
 * @param details - Optional error details
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: unknown,
): Response {
  const response: ApiError = {
    error: message,
  };

  if (code) {
    response.code = code;
  }

  if (details && typeof details === "object" && details !== null) {
    response.details = details;
  }

  return Response.json(response, { status });
}

/**
 * Create a 400 Bad Request response
 */
export function createBadRequestResponse(
  message: string = "Bad Request",
  details?: unknown,
): Response {
  return createErrorResponse(message, 400, "BAD_REQUEST", details);
}

/**
 * Create a 401 Unauthorized response
 */
export function createUnauthorizedResponse(
  message: string = "Unauthorized",
): Response {
  return createErrorResponse(message, 401, "UNAUTHORIZED");
}

/**
 * Create a 403 Forbidden response
 */
export function createForbiddenResponse(
  message: string = "Forbidden",
): Response {
  return createErrorResponse(message, 403, "FORBIDDEN");
}

/**
 * Create a 404 Not Found response
 */
export function createNotFoundResponse(
  message: string = "Not Found",
): Response {
  return createErrorResponse(message, 404, "NOT_FOUND");
}

/**
 * Create a 500 Internal Server Error response
 * SECURITY FIX (SEC-008): Sanitize error details to prevent information leakage
 */
export function createInternalErrorResponse(
  message: string = "Internal Server Error",
  details?: unknown,
): Response {
  // SECURITY: Sanitize error details to prevent leaking sensitive information
  // Only include safe, generic error information in client responses
  // Detailed errors are logged server-side via debugLog
  let sanitizedDetails: unknown = undefined;

  if (details !== undefined) {
    // Only include error details if they're safe (not Error objects with stack traces)
    if (details instanceof Error) {
      // Don't send Error objects - they may contain stack traces and sensitive info
      sanitizedDetails = undefined;
    } else if (typeof details === "object" && details !== null) {
      // Sanitize object details to remove PII
      sanitizedDetails = sanitizeObject(details);
    } else {
      // Primitive types are generally safe, but sanitize strings
      sanitizedDetails =
        typeof details === "string" ? sanitizeString(details) : details;
    }
  }

  return createErrorResponse(message, 500, "INTERNAL_ERROR", sanitizedDetails);
}
