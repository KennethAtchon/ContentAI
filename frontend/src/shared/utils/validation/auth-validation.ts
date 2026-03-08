import { z } from "zod";

/**
 * Authentication form validation schemas
 *
 * These schemas provide comprehensive validation for sign-in and sign-up forms,
 * including XSS and SQL injection prevention.
 */

// Email validation schema (reusable)
const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email must be less than 255 characters")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email must be a valid format")
  .refine((email) => {
    // Additional business rules for email
    const domain = email.split("@")[1];
    return domain && domain.length > 2 && !domain.includes("..");
  }, "Invalid email domain")
  .refine((email) => {
    // Prevent XSS attempts in email
    return (
      !email.includes("<") && !email.includes(">") && !email.includes("script")
    );
  }, "Email contains invalid characters");

// Password validation schema
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password must be less than 128 characters")
  .refine((password) => {
    // Prevent SQL injection patterns
    const sqlPatterns = [
      /';.*--/,
      /' OR '1'='1/,
      /' OR '1'='1'--/,
      /' UNION SELECT/,
      /'; DROP TABLE/,
      /' OR 1=1--/,
    ];
    return !sqlPatterns.some((pattern) => pattern.test(password));
  }, "Password contains invalid characters")
  .refine((password) => {
    // Prevent XSS attempts
    return !password.includes("<") && !password.includes(">");
  }, "Password contains invalid characters");

// Name validation schema (for sign-up)
const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be less than 100 characters")
  .regex(
    /^[a-zA-ZÀ-ÿ\u00C0-\u017F\s\-\.'\.]+$/,
    "Name can only contain letters, spaces, hyphens, apostrophes, and periods"
  )
  .trim()
  .refine((name) => {
    // Additional XSS prevention
    return (
      !name.includes("<") && !name.includes(">") && !name.includes("script")
    );
  }, "Name contains invalid characters");

// Sign-in form validation schema
export const signInValidationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type SignInFormData = z.infer<typeof signInValidationSchema>;

// Sign-up form validation schema
export const signUpValidationSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpFormData = z.infer<typeof signUpValidationSchema>;

// Individual field validation functions for real-time validation
export const validateAuthField = {
  email: (value: string) => {
    try {
      emailSchema.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid email" };
    }
  },

  password: (value: string) => {
    try {
      passwordSchema.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid password" };
    }
  },

  name: (value: string) => {
    try {
      nameSchema.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid name" };
    }
  },

  confirmPassword: (password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      return { isValid: false, error: "Passwords do not match" };
    }
    return { isValid: true, error: null };
  },
};

/**
 * Validate sign-in form data
 */
export function validateSignInForm(data: unknown): {
  isValid: boolean;
  errors?: Record<string, string>;
  data?: SignInFormData;
} {
  const result = signInValidationSchema.safeParse(data);

  if (result.success) {
    return { isValid: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    errors[path] = issue.message;
  });

  return { isValid: false, errors };
}

/**
 * Validate sign-up form data
 */
export function validateSignUpForm(data: unknown): {
  isValid: boolean;
  errors?: Record<string, string>;
  data?: SignUpFormData;
} {
  const result = signUpValidationSchema.safeParse(data);

  if (result.success) {
    return { isValid: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    errors[path] = issue.message;
  });

  return { isValid: false, errors };
}
