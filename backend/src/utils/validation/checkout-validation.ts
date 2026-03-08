import { z } from "zod";

// US state abbreviations for validation
const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
] as const;

export const checkoutValidationSchema = z.object({
  // Contact Information
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(
      /^[a-zA-ZÀ-ÿ\u0100-\u017F\s'-]+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes",
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
    }, "Name contains invalid characters"),

  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),

  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^[\+]?[\d\s\-\.\(\)]+$/, "Please enter a valid phone number")
    .refine((val) => {
      // Must not contain letters
      if (/[a-zA-Z]/.test(val)) return false;
      // Check for obviously invalid patterns
      const digitsOnly = val.replace(/\D/g, "");
      // Allow 5+ digits but reject patterns like "123-456" by checking structure
      if (digitsOnly.length < 5) return false;
      if (digitsOnly.length === 6 && /^\d{3}[\-\.\s]*\d{3}$/.test(val))
        return false;
      return true;
    }, "Please enter a valid phone number")
    .transform((val) => val.replace(/\D/g, ""))
    .refine(
      (val) => val.length >= 10 && val.length <= 11,
      "Phone number must be 10-11 digits",
    ),

  contactMethod: z.enum(["email", "phone", "text"], {
    message: "Please select a contact method",
  }),

  // Address Information
  address: z
    .string()
    .min(5, "Street address must be at least 5 characters")
    .max(200, "Street address must be less than 200 characters")
    .regex(/^[a-zA-Z0-9\s\-\.,#]+$/, "Address contains invalid characters"),

  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must be less than 100 characters")
    .regex(
      /^[a-zA-Z\s\-'\.]+$/,
      "City can only contain letters, spaces, hyphens, apostrophes, and periods",
    ),

  state: z
    .string()
    .length(2, "State must be 2 characters")
    .regex(/^[A-Z]{2}$/, "State must be uppercase abbreviation (e.g., CA, NY)")
    .refine(
      (val) => US_STATES.includes(val as any),
      "Please enter a valid US state abbreviation",
    ),

  zip: z
    .string()
    .min(5, "ZIP code must be at least 5 digits")
    .max(10, "ZIP code must be less than 10 characters")
    .regex(
      /^\d{5}(-\d{4})?$/,
      "ZIP code must be in format 12345 or 12345-1234",
    ),

  // Additional Information
  notes: z
    .string()
    .max(1000, "Notes must be less than 1000 characters")
    .optional()
    .or(z.literal("")),

  // Terms Agreement
  agreeToTerms: z
    .boolean()
    .refine(
      (val) => val === true,
      "You must agree to the terms and conditions",
    ),
});

export type CheckoutFormData = z.infer<typeof checkoutValidationSchema>;

// Individual field validation functions for real-time validation
export const validateField = {
  name: (value: string) => {
    try {
      checkoutValidationSchema.shape.name.parse(value);
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
      checkoutValidationSchema.shape.email.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid email" };
    }
  },

  phone: (value: string) => {
    try {
      checkoutValidationSchema.shape.phone.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid phone number" };
    }
  },

  address: (value: string) => {
    try {
      checkoutValidationSchema.shape.address.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid address" };
    }
  },

  city: (value: string) => {
    try {
      checkoutValidationSchema.shape.city.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid city" };
    }
  },

  state: (value: string) => {
    try {
      checkoutValidationSchema.shape.state.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid state" };
    }
  },

  zip: (value: string) => {
    try {
      checkoutValidationSchema.shape.zip.parse(value);
      return { isValid: true, error: null };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Invalid ZIP code" };
    }
  },
};

// Format phone number for display
export const formatPhoneNumber = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, "");

  if (digitsOnly.length === 0) return "";
  if (digitsOnly.length <= 3) return digitsOnly;
  if (digitsOnly.length <= 6)
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;

  return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
};

// Format ZIP code for display - only allow digits and format as 12345 or 12345-1234
export const formatZipCode = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, "");

  if (digitsOnly.length === 0) return "";
  if (digitsOnly.length <= 5) return digitsOnly;

  // Format as 12345-1234 for zip+4
  return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 9)}`;
};
