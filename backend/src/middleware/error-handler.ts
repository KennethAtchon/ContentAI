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
    const body: { error: string; code: string; details?: unknown } = {
      error: err.message,
      code: err.code,
    };
    if (err.details !== undefined) {
      body.details = err.details;
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
