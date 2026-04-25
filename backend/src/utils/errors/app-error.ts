/**
 * Typed API errors for use with the global route error handler (`handleRouteError`).
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

  toResponseBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      error: this.message,
      code: this.code,
    };

    if (this.details === undefined) {
      return body;
    }

    body.details = this.details;

    if (typeof this.details !== "object" || this.details === null) {
      return body;
    }

    const details = this.details as Record<string, unknown>;

    if (
      this.code === "PROJECT_EXISTS" &&
      typeof details.existingProjectId === "string"
    ) {
      body.existingProjectId = details.existingProjectId;
    }

    if (this.code === "VIDEO_JOB_IN_PROGRESS") {
      if (typeof details.jobId === "string") {
        body.jobId = details.jobId;
      }
      if (typeof details.kind === "string") {
        body.kind = details.kind;
      }
    }

    return body;
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

  serviceUnavailable: (message: string) =>
    new AppError(message, "SERVICE_UNAVAILABLE", 503),

  notConfigured: (message: string) =>
    new AppError(message, "NOT_CONFIGURED", 500),
};
