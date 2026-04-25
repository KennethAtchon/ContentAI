import { systemLogger } from "@/utils/system/system-logger";
import {
  createCustomerOrderSchema as sharedCreateCustomerOrderSchema,
  updateCustomerProfileSchema as sharedUpdateCustomerProfileSchema,
} from "@contracts/customer";
import { z } from "zod";

/**
 * Comprehensive API Request Validation Schemas
 *
 * This file contains validation schemas for all API endpoints to ensure
 * data integrity, security, and business rule compliance.
 */

const _currencyAmountSchema = z
  .number()
  .positive("Amount must be positive")
  .multipleOf(0.01, "Amount must have at most 2 decimal places")
  .max(999999.99, "Amount cannot exceed $999,999.99")
  .refine(
    (value) => Number.isFinite(value) && value > 0,
    "Amount must be a finite positive number",
  );

const quantitySchema = z
  .number()
  .int("Quantity must be an integer")
  .min(1, "Quantity must be at least 1")
  .max(100, "Quantity cannot exceed 100");

export const uuidSchema = z
  .string()
  .uuid("Must be a valid UUID")
  .refine(
    (value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
    "Invalid UUID format",
  );

const phoneNumberSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .max(17, "Phone number cannot exceed 17 characters")
  .regex(/^[\+]?[\d\s\-\.\(\)]+$/, "Invalid phone number format")
  .transform((val) => val.replace(/\D/g, ""))
  .refine(
    (val) => val.length >= 10 && val.length <= 15,
    "Phone number must be 10-15 digits",
  );

const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(255, "Email must be less than 255 characters")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email must be a valid format")
  .refine((email) => {
    const domain = email.split("@")[1];
    return domain && domain.length > 2 && !domain.includes("..");
  }, "Invalid email domain");

const notesSchema = z
  .string()
  .max(2000, "Notes cannot exceed 2000 characters")
  .optional()
  .transform((val) => val?.trim() || undefined);

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name cannot exceed 100 characters")
  .regex(
    /^[a-zA-Z\s\-'\.]+$/,
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

// Status enums
const orderStatusSchema = z.enum(
  ["pending", "confirmed", "processing", "completed", "cancelled", "refunded"],
  {
    message: "Invalid order status",
  },
);

const futureDateTimeSchema = z.iso
  .datetime()
  .refine((dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    return date > now;
  }, "Date must be in the future")
  .refine((dateStr) => {
    const date = new Date(dateStr);
    const maxFuture = new Date();
    maxFuture.setFullYear(maxFuture.getFullYear() + 2); // Max 2 years in future
    return date <= maxFuture;
  }, "Date cannot be more than 2 years in the future");

const timezoneSchema = z
  .string()
  .min(1, "Timezone is required")
  .refine((tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Invalid timezone format. Must be a valid IANA timezone identifier");

export const createOrderSchema = z
  .object({
    therapies: z
      .array(
        z.object({
          therapyId: uuidSchema,
          quantity: quantitySchema,
        }),
      )
      .min(1, "At least one therapy must be specified")
      .max(20, "Cannot order more than 20 different therapies"),

    status: orderStatusSchema.optional().default("pending"),

    stripeSessionId: z
      .string()
      .min(1, "Stripe session ID is required")
      .regex(/^cs_[a-zA-Z0-9_]+$/, "Invalid Stripe session ID format")
      .optional(),

    skipPayment: z.boolean().optional().default(true),

    notes: notesSchema,
  })
  .refine(
    (data) => {
      const totalQuantity = data.therapies.reduce(
        (sum, t) => sum + t.quantity,
        0,
      );
      return totalQuantity <= 200; // Max 200 total items
    },
    {
      message: "Total quantity of all therapies cannot exceed 200",
      path: ["therapies"],
    },
  );

export const createCustomerOrderSchema = sharedCreateCustomerOrderSchema;

export const updateOrderSchema = z
  .object({
    id: uuidSchema,
    status: orderStatusSchema.optional(),
    therapies: z
      .array(
        z.object({
          therapyId: uuidSchema,
          quantity: quantitySchema,
        }),
      )
      .optional(),
    notes: notesSchema,
  })
  .refine(
    (data) => {
      if (data.therapies) {
        const totalQuantity = data.therapies.reduce(
          (sum, t) => sum + t.quantity,
          0,
        );
        return totalQuantity <= 200;
      }
      return true;
    },
    {
      message: "Total quantity of all therapies cannot exceed 200",
      path: ["therapies"],
    },
  );

export const updateProfileSchema = sharedUpdateCustomerProfileSchema;

export const fileUploadSchema = z.object({
  file: z.object({
    name: z
      .string()
      .min(1, "Filename is required")
      .max(255, "Filename cannot exceed 255 characters")
      .refine((val) => {
        if (/[<>:"/\\|?*\x00-\x1f]/.test(val)) return false;
        if (val.includes("..")) return false;
        if (/^[\/\\]/.test(val)) return false;
        return true;
      }, "Filename contains invalid characters or dangerous patterns"),
    size: z
      .number()
      .int("File size must be an integer")
      .min(1, "File cannot be empty")
      .max(10 * 1024 * 1024, "File cannot exceed 10MB"),
    type: z
      .string()
      .regex(
        /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/,
        "Invalid MIME type",
      ),
  }),
  category: z
    .enum(["therapy_image", "profile_avatar", "document"], {
      message: "Invalid file category",
    })
    .optional()
    .default("document"),
});

// Contact Message Validation
export const contactMessageSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneNumberSchema.optional(),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject cannot exceed 200 characters")
    .trim(),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message cannot exceed 5000 characters"),
  category: z
    .enum(["general", "support", "billing"], {
      message: "Invalid message category",
    })
    .optional()
    .default("general"),
});

export const createTimeSlotSchema = z
  .object({
    staffId: uuidSchema,
    startTime: futureDateTimeSchema,
    endTime: futureDateTimeSchema,
    type: z.enum(["AVAILABLE", "BLOCKED", "BOOKED"], {
      message: "Invalid time slot type",
    }),
    reason: z
      .string()
      .max(500, "Reason cannot exceed 500 characters")
      .optional()
      .transform((val) => val?.trim() || undefined),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end > start;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    },
  )
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return diffHours <= 8;
    },
    {
      message: "Time slot cannot exceed 8 hours",
      path: ["endTime"],
    },
  );

export const validateCurrencyAmount = (
  amount: number,
  context: string,
): boolean => {
  if (!Number.isFinite(amount)) {
    throw new Error(`${context}: Amount must be a finite number`);
  }
  if (amount <= 0) {
    throw new Error(`${context}: Amount must be positive`);
  }
  if (Math.round(amount * 100) !== amount * 100) {
    throw new Error(
      `${context}: Amount cannot have more than 2 decimal places`,
    );
  }
  if (amount > 999999.99) {
    throw new Error(`${context}: Amount cannot exceed $999,999.99`);
  }
  return true;
};

export const sanitizeFinancialData = (data: any) => {
  if (typeof data.totalAmount === "number") {
    data.totalAmount = Math.round(data.totalAmount * 100) / 100; // Round to 2 decimal places
  }
  return data;
};

/**
 * Generic validation helper with enhanced error reporting
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context: string,
):
  | { success: true; data: T }
  | { success: false; error: string; details?: any } {
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
        code: e.code,
      }));

      systemLogger.warn(`Failed validation in ${context}`, {
        service: "api-validation",
        operation: "validateWithSchema",
        context,
        errors: formattedErrors,
        inputType: typeof input,
        timestamp: new Date().toISOString(),
      });

      const errorMessage = error.issues
        .map((e) =>
          e.path.length > 0 ? `${e.path.join(".")}: ${e.message}` : e.message,
        )
        .join(", ");

      return {
        success: false,
        error: errorMessage,
        details: formattedErrors,
      };
    }

    systemLogger.error(`Unexpected validation error in ${context}`, {
      service: "api-validation",
      operation: "validateWithSchema",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { success: false, error: "Invalid input format" };
  }
}

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters")
    .optional(),
  createInFirebase: z.boolean().optional().default(false),
  timezone: timezoneSchema.optional().default("UTC"),
});

export const updateUserSchema = z.object({
  id: uuidSchema,
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneNumberSchema.optional(),
  address: z
    .string()
    .max(500, "Address cannot exceed 500 characters")
    .optional()
    .transform((val) => val?.trim() || undefined),
  role: z.enum(["user", "admin"]).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters")
    .optional(),
  isActive: z.boolean().optional(),
  timezone: timezoneSchema.optional(),
});

// Subscription Portal Link Schema
export const subscriptionPortalLinkSchema = z.object({
  returnUrl: z
    .string()
    .url("Return URL must be a valid URL")
    .max(500, "Return URL cannot exceed 500 characters")
    .optional(),
});

export const createAdminOrderSchema = z.object({
  userId: uuidSchema,
  totalAmount: z
    .number()
    .positive("Total amount must be positive")
    .multipleOf(0.01, "Amount must have at most 2 decimal places")
    .max(999999.99, "Amount cannot exceed $999,999.99"),
  status: orderStatusSchema.optional().default("pending"),
});

export const updateAdminOrderSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema.optional(),
  totalAmount: z
    .number()
    .positive("Total amount must be positive")
    .multipleOf(0.01, "Amount must have at most 2 decimal places")
    .max(999999.99, "Amount cannot exceed $999,999.99")
    .optional(),
  status: orderStatusSchema.optional(),
});

export const updateSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription ID is required"),
  status: z
    .enum(["active", "canceled", "past_due", "trialing", "paused"])
    .optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

export const deleteAccountSchema = z.object({
  confirm: z
    .literal(true, {
      message: "Account deletion must be confirmed",
    })
    .optional(),
  reason: z.string().max(500).optional(),
});

export const adminVerifySchema = z.object({
  adminCode: z.string().min(1, "Admin code is required"),
});

export const adminSyncFirebaseSchema = z.object({
  userId: uuidSchema.optional(),
  syncAll: z.boolean().optional().default(false),
});

export const webVitalsSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.number().finite(),
  id: z.string().optional(),
  url: z.string().url().optional(),
});

export const searchPerformanceSchema = z.object({
  query: z.string().min(1).max(200),
  resultsCount: z.number().int().nonnegative(),
  responseTime: z.number().positive().finite(),
});

export const formProgressSchema = z.object({
  formId: z.string().min(1).max(100),
  step: z.number().int().positive(),
  completed: z.boolean(),
});

export const formCompletionSchema = z.object({
  formId: z.string().min(1).max(100),
  completed: z.boolean(),
  timeSpent: z.number().int().nonnegative().optional(),
});

export const sendEmailSchema = z.object({
  to: emailSchema,
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  from: emailSchema.optional(),
});

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
});

export const deleteUserSchema = z.object({
  id: uuidSchema,
  hardDelete: z.boolean().optional().default(false),
});

export const deleteOrderSchema = z.object({
  id: uuidSchema,
  deletedBy: z.string().max(255).optional(),
});

export const deleteFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
});

export const usersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["user", "admin"]).optional(),
  isActive: z
    .string()
    .regex(/^(true|false)$/)
    .transform((val) => val === "true")
    .optional(),
});

export const adminOrdersQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "completed",
      "cancelled",
      "refunded",
    ])
    .optional(),
  userId: z.string().uuid().optional(),
});

export const adminCustomersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["user", "admin"]).optional(),
  isActive: z
    .string()
    .regex(/^(true|false)$/)
    .transform((val) => val === "true")
    .optional(),
});

export const adminSubscriptionsQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(["active", "canceled", "past_due", "trialing", "paused"])
    .optional(),
  tier: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
});

export const ordersQuerySchema = z.object({
  id: z.string().uuid().optional(),
  includeDeleted: z
    .string()
    .regex(/^(true|false)$/)
    .transform((val) => val === "true")
    .optional(),
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .optional(),
  status: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "completed",
      "cancelled",
      "refunded",
    ])
    .optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
});

export const orderBySessionQuerySchema = z.object({
  session_id: z.string().min(1, "Session ID is required"),
});

export const totalRevenueQuerySchema = z.object({
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
});

export const contactMessagesQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
});

export const reelsHistoryQuerySchema = paginationQuerySchema.extend({
  type: z.enum(["reels", "custom"]).optional(),
});

export const reelsUsageQuerySchema = paginationQuerySchema.extend({
  type: z.enum(["reels", "custom"]).optional(),
});

// Type exports for use in API endpoints
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
export type CreateTimeSlotInput = z.infer<typeof createTimeSlotSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AdminOrderCreateInput = z.infer<typeof createAdminOrderSchema>;
export type AdminOrderUpdateInput = z.infer<typeof updateAdminOrderSchema>;
