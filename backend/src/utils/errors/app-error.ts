/**
 * Typed API errors for use with the global route error handler.
 * Phase 1: defined and wired; routes may still return c.json() manually.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  notFound: (resource: string) =>
    new AppError(`${resource} not found`, "NOT_FOUND", 404),

  unauthorized: () =>
    new AppError("Authentication required", "AUTH_REQUIRED", 401),

  forbidden: (reason?: string) =>
    new AppError(reason ?? "Access denied", "FORBIDDEN", 403),

  usageLimitReached: () =>
    new AppError("Usage limit reached", "USAGE_LIMIT_REACHED", 403),

  versionConflict: () =>
    new AppError(
      "Version conflict — refresh and try again",
      "VERSION_CONFLICT",
      409,
    ),

  validationFailed: (details: unknown) =>
    new AppError("Validation failed", "INVALID_INPUT", 422, details),

  internal: (message = "Internal server error") =>
    new AppError(message, "INTERNAL_ERROR", 500),

  badRequest: (message: string, code = "BAD_REQUEST") =>
    new AppError(message, code, 400),

  conflict: (message: string, code = "CONFLICT") =>
    new AppError(message, code, 409),
};
