import type { Context, ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../utils/errors/app-error";
import { systemLogger } from "../utils/system/system-logger";

/**
 * Hono `onError` handler: normalizes thrown errors to the standard API shape
 * `{ error, code, details? }`.
 */
export const handleRouteError: ErrorHandler = (err, c: Context) => {
  if (err instanceof AppError) {
    return c.json(err.toResponseBody(), err.statusCode as ContentfulStatusCode);
  }

  systemLogger.error(
    "Unhandled error",
    { service: "error-handler", operation: "onError" },
    err,
  );
  return c.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    500,
  );
};
