import type { Context } from "hono";

export type ValidationResult = {
  success: boolean;
  error?: { issues: unknown[] };
};

export function adminConfigValidationErrorHook(
  result: ValidationResult,
  c: Context,
) {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
}
