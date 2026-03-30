import type { Context, ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../utils/errors/app-error";
import { debugLog } from "../utils/debug/debug";

/**
 * Hono `onError` handler: normalizes thrown errors to the standard API shape
 * `{ error, code, details? }`.
 */
export const handleRouteError: ErrorHandler = (err, c: Context) => {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      error: err.message,
      code: err.code,
    };
    if (err.details !== undefined) {
      body.details = err.details;
      if (
        err.code === "PROJECT_EXISTS" &&
        typeof err.details === "object" &&
        err.details !== null &&
        "existingProjectId" in err.details
      ) {
        body.existingProjectId = (
          err.details as { existingProjectId: string }
        ).existingProjectId;
      }
      if (
        err.code === "VIDEO_JOB_IN_PROGRESS" &&
        typeof err.details === "object" &&
        err.details !== null
      ) {
        const d = err.details as { jobId?: string; kind?: string };
        if (d.jobId !== undefined) body.jobId = d.jobId;
        if (d.kind !== undefined) body.kind = d.kind;
      }
    }
    return c.json(body, err.statusCode as ContentfulStatusCode);
  }

  debugLog.error(
    "Unhandled error",
    { service: "error-handler", operation: "onError" },
    err,
  );
  return c.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    500,
  );
};
