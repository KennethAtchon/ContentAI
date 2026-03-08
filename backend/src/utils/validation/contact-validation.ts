import { z } from "zod";

/**
 * Contact form validation schema that matches server-side validation
 * Based on contactMessageSchema from api-validation.ts
 */

// Base schemas that match server-side validation
const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name cannot exceed 100 characters")
  .regex(
    /^[a-zA-ZÀ-ÿ\u00C0-\u017F\s\-'\.]+$/,
    "Name can only contain letters, spaces, hyphens, apostrophes, and periods",
  )
  .refine((val) => {
    // Reject SQL injection patterns
    const sqlPatterns = [
      /;\s*(DROP|DELETE|UPDATE|INSERT|SELECT|ALTER|CREATE|EXEC|EXECUTE)/i,
      /'\s*(OR|AND)\s*'/i,
      /--/,
      /\/\*/,
      /\*\//,
      /xp_/i,
      /sp_/i,
    ];
    return !sqlPatterns.some((pattern) => pattern.test(val));
  }, "Name contains invalid characters");

const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(255, "Email must be less than 255 characters")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email must be a valid format")
  .refine((email) => {
    // Additional business rules for email
    const domain = email.split("@")[1];
    return domain && domain.length > 2 && !domain.includes("..");
  }, "Invalid email domain");

const phoneNumberSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .max(17, "Phone number cannot exceed 17 characters")
  .regex(/^[\+]?[\d\s\-\.\(\)]+$/, "Invalid phone number format")
  .transform((val) => val.replace(/\D/g, ""))
  .refine(
    (val) => val.length >= 10 && val.length <= 15,
    "Phone number must be 10-15 digits",
  )
  .optional();

const subjectSchema = z
  .string()
  .min(1, "Subject is required")
  .max(200, "Subject cannot exceed 200 characters")
  .trim();

const messageSchema = z
  .string()
  .trim()
  .min(10, "Message must be at least 10 characters")
  .max(5000, "Message cannot exceed 5000 characters");

// Contact form validation schema
export const contactFormValidationSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneNumberSchema,
  subject: subjectSchema,
  message: messageSchema,
});

export type ContactFormData = z.infer<typeof contactFormValidationSchema>;

// Individual field validation functions for real-time validation
export const validateContactField = {
  name: (value: string) => {
    try {
      contactFormValidationSchema.shape.name.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid name" };
    }
  },

  email: (value: string) => {
    try {
      contactFormValidationSchema.shape.email.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid email" };
    }
  },

  phone: (value: string) => {
    // Phone is optional, so empty values are valid
    if (!value || value.trim() === "") {
      return { isValid: true, error: null };
    }

    try {
      contactFormValidationSchema.shape.phone.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid phone number" };
    }
  },

  subject: (value: string) => {
    try {
      contactFormValidationSchema.shape.subject.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid subject" };
    }
  },

  message: (value: string) => {
    try {
      contactFormValidationSchema.shape.message.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid message" };
    }
  },
};

// Format phone number for display (matches checkout-validation pattern)
export const formatContactPhoneNumber = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, "");

  if (digitsOnly.length === 0) return "";
  if (digitsOnly.length <= 3) return digitsOnly;
  if (digitsOnly.length <= 6)
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;

  return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
};

// Validate entire form data
export const validateContactForm = (
  data: any,
): { isValid: boolean; errors: Record<string, string> } => {
  const result = contactFormValidationSchema.safeParse(data);

  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  result.error.issues.forEach((error) => {
    if (error.path.length > 0) {
      errors[error.path[0] as string] = error.message;
    }
  });

  return { isValid: false, errors };
};
