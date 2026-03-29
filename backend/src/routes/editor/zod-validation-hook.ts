import type { Context } from "hono";

type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

/** Shared hook for `zValidator` on editor routes — consistent 422 shape. */
export function editorZodValidationHook(
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
