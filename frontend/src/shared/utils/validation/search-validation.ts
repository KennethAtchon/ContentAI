import { z } from "zod";

/**
 * SQL Injection Prevention Validation Schemas
 *
 * These schemas provide comprehensive input validation to prevent SQL injection
 * and other security vulnerabilities in search and query parameters.
 */

// Unused variable removed - was causing ESLint error

// Pagination parameters validation
const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) ? 1 : Math.max(1, Math.min(10000, num));
    }),

  limit: z
    .string()
    .optional()
    .default("20")
    .transform((val) => {
      const num = parseInt(val, 10);
      return isNaN(num) ? 20 : Math.max(1, Math.min(100, num));
    }),

  search: z
    .string()
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
});

// Customer search validation
export const customerSearchSchema = z.object({
  page: paginationSchema.shape.page,
  limit: paginationSchema.shape.limit,
  search: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .default("")
    .transform((val) => {
      if (val === null || val === undefined) return "";
      return typeof val === "string" ? val.trim() : "";
    })
    .refine(
      (value) => !value || (value.length >= 2 && value.length <= 100),
      "Search term must be between 2 and 100 characters"
    )
    .refine(
      (value) => !value || /^[a-zA-Z0-9\s\-_.@]+$/.test(value),
      "Search term contains invalid characters"
    )
    .refine(
      (value) => !value || !containsSqlInjectionPatterns(value),
      "Invalid search pattern detected"
    ),
});

// Order search validation
export const orderSearchSchema = z.object({
  page: paginationSchema.shape.page,
  limit: paginationSchema.shape.limit,
  search: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .default("")
    .transform((val) => {
      if (val === null || val === undefined) return "";
      return typeof val === "string" ? val.trim() : "";
    })
    .refine(
      (value) => !value || (value.length >= 1 && value.length <= 100),
      "Search term must be between 1 and 100 characters"
    )
    .refine(
      (value) => !value || /^[a-zA-Z0-9\s\-_.@]+$/.test(value),
      "Search term contains invalid characters"
    )
    .refine(
      (value) => !value || !containsSqlInjectionPatterns(value),
      "Invalid search pattern detected"
    ),
  customerId: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .default("")
    .transform((val) => {
      if (val === null || val === undefined) return "";
      return typeof val === "string" ? val.trim() : "";
    })
    .refine(
      (value) =>
        !value ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value
        ),
      "Customer ID must be a valid UUID"
    ),
});

// User search validation
export const userSearchSchema = z.object({
  page: paginationSchema.shape.page,
  limit: paginationSchema.shape.limit,
  search: z
    .string()
    .optional()
    .default("")
    .transform((val) => val?.trim() || "")
    .refine(
      (value) => !value || (value.length >= 2 && value.length <= 100),
      "Search term must be between 2 and 100 characters"
    )
    .refine(
      (value) => !value || /^[a-zA-Z0-9\s\-_.@]+$/.test(value),
      "Search term contains invalid characters"
    )
    .refine(
      (value) => !value || !containsSqlInjectionPatterns(value),
      "Invalid search pattern detected"
    ),
});

// Database health monitoring parameters validation
export const dbHealthSchema = z.object({
  minutes: z.coerce
    .number()
    .int("Minutes must be an integer")
    .min(1, "Minutes must be at least 1")
    .max(1440, "Minutes must be less than 1440 (24 hours)")
    .default(60),
});

// Generic ID validation for path parameters
export const idSchema = z
  .string()
  .uuid("ID must be a valid UUID")
  .refine(
    (value) => !containsSqlInjectionPatterns(value),
    "Invalid ID format detected"
  );

// Email validation with security checks
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(255, "Email must be less than 255 characters")
  .refine(
    (value) => !containsSqlInjectionPatterns(value),
    "Invalid email pattern detected"
  );

/**
 * Detects common SQL injection patterns in input
 */
function containsSqlInjectionPatterns(input: string): boolean {
  if (!input || typeof input !== "string") return false;

  const normalizedInput = input.toLowerCase().replace(/\s+/g, " ");

  // Common SQL injection patterns
  const sqlInjectionPatterns = [
    // Classic SQL injection
    /('|(\\')|(;)|(--)|(\/\*)|\*\/)/,

    // UNION attacks
    /\bunion\b.*\bselect\b/,
    /\bselect\b.*\bunion\b/,

    // Boolean-based attacks
    /\bor\b.*=.*\bor\b/,
    /\band\b.*=.*\band\b/,
    /\b1\s*=\s*1\b/,
    /\b1\s*=\s*0\b/,

    // Time-based attacks
    /\bwaitfor\b.*\bdelay\b/,
    /\bsleep\b\s*\(/,
    /\bbenchmark\b\s*\(/,

    // Stacked queries
    /;\s*(insert|update|delete|drop|create|alter)\b/,

    // Information schema attacks
    /\binformation_schema\b/,
    /\bsysobjects\b/,
    /\bsys\.tables\b/,

    // Function calls that could be dangerous
    /\b(exec|execute|sp_|xp_)\b/,
    /\b(char|ascii|concat)\s*\(/,

    // Hex/binary data
    /0x[0-9a-f]+/,

    // Comment patterns
    /\/\*.*\*\//,
    /--.*$/,
    /#.*$/,
  ];

  return sqlInjectionPatterns.some((pattern) => pattern.test(normalizedInput));
}

/**
 * Safe validation helper that catches and logs validation errors
 */
export function validateSearchInput(
  schema: z.ZodType<unknown>,
  input: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map((e) => e.message).join(", ");

      // Security logging removed for production

      return { success: false, error: errorMessage };
    }

    // Error logging removed for production
    return { success: false, error: "Invalid input" };
  }
}

/**
 * Sanitizes search terms for safe database queries
 */
export function sanitizeSearchTerm(term: string): string {
  if (!term || typeof term !== "string") return "";

  return term
    .trim()
    .replace(/[^\w\s\-_.@]/g, "") // Remove special characters except allowed ones
    .substring(0, 100); // Limit length
}

/**
 * Type definitions for validated search parameters
 */
export type ValidatedCustomerSearch = z.infer<typeof customerSearchSchema>;
export type ValidatedOrderSearch = z.infer<typeof orderSearchSchema>;
export type ValidatedUserSearch = z.infer<typeof userSearchSchema>;
export type ValidatedDbHealth = z.infer<typeof dbHealthSchema>;
export type ValidatedId = z.infer<typeof idSchema>;
export type ValidatedEmail = z.infer<typeof emailSchema>;
