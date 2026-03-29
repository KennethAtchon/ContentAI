/**
 * API validation schemas and helpers – full branch coverage.
 */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  createOrderSchema,
  updateOrderSchema,
  createCustomerOrderSchema,
  updateProfileSchema,
  fileUploadSchema,
  contactMessageSchema,
  createTimeSlotSchema,
  validateInput,
  validateCurrencyAmount,
  sanitizeFinancialData,
  createUserSchema,
  subscriptionPortalLinkSchema,
  createAdminOrderSchema,
  updateAdminOrderSchema,
  updateSubscriptionSchema,
  deleteAccountSchema,
  adminVerifySchema,
  adminSyncFirebaseSchema,
  webVitalsSchema,
  searchPerformanceSchema,
  formProgressSchema,
  formCompletionSchema,
  sendEmailSchema,
  paginationQuerySchema,
  deleteUserSchema,
  deleteOrderSchema,
  deleteFileSchema,
  usersQuerySchema,
  adminOrdersQuerySchema,
  adminCustomersQuerySchema,
  adminSubscriptionsQuerySchema,
  ordersQuerySchema,
  orderBySessionQuerySchema,
  totalRevenueQuerySchema,
  contactMessagesQuerySchema,
  reelsHistoryQuerySchema,
  reelsUsageQuerySchema,
  uuidSchema,
  reelsExportSchema,
} from "@/shared/validation/api.schema";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

describe("api-validation", () => {
  describe("validateInput", () => {
    test("returns success for valid input", () => {
      const schema = z.object({ a: z.number() });
      const result = validateInput(schema, { a: 1 }, "test");
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual({ a: 1 });
    });

    test("returns ZodError details for invalid input", () => {
      const schema = z.object({ a: z.number() });
      const result = validateInput(schema, { a: "x" }, "test");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
      }
    });

    test("returns generic error for non-ZodError throw", () => {
      const schema = z.object({ a: z.number() }).transform(() => {
        throw new Error("custom");
      });
      const result = validateInput(schema, { a: 1 }, "test");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Invalid input format");
    });
  });

  describe("validateCurrencyAmount", () => {
    test("returns true for valid amount", () => {
      expect(validateCurrencyAmount(100.5, "ctx")).toBe(true);
    });
    test("throws for non-finite", () => {
      expect(() => validateCurrencyAmount(Number.NaN, "ctx")).toThrow();
      expect(() => validateCurrencyAmount(Infinity, "ctx")).toThrow();
    });
    test("throws for non-positive", () => {
      expect(() => validateCurrencyAmount(0, "ctx")).toThrow();
      expect(() => validateCurrencyAmount(-1, "ctx")).toThrow();
    });
    test("throws for more than 2 decimal places", () => {
      expect(() => validateCurrencyAmount(1.234, "ctx")).toThrow();
    });
    test("throws for amount over max", () => {
      expect(() => validateCurrencyAmount(1000000, "ctx")).toThrow();
    });
  });

  describe("sanitizeFinancialData", () => {
    test("rounds totalAmount to 2 decimals", () => {
      const data = { totalAmount: 10.999 };
      expect(sanitizeFinancialData(data).totalAmount).toBe(11);
    });
    test("leaves object unchanged when totalAmount is not number", () => {
      const data = { totalAmount: "100" };
      expect(sanitizeFinancialData(data)).toBe(data);
    });
  });

  describe("uuidSchema", () => {
    test("accepts valid UUID", () => {
      expect(uuidSchema.safeParse(validUuid).success).toBe(true);
    });
    test("rejects invalid format", () => {
      expect(uuidSchema.safeParse("not-uuid").success).toBe(false);
    });
  });

  describe("createOrderSchema", () => {
    test("rejects total quantity over 200", () => {
      const result = createOrderSchema.safeParse({
        therapies: Array.from({ length: 21 }, () => ({
          therapyId: validUuid,
          quantity: 10,
        })),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateOrderSchema", () => {
    test("accepts valid update without therapies", () => {
      const result = updateOrderSchema.safeParse({
        id: validUuid,
      });
      expect(result.success).toBe(true);
    });
    test("rejects therapies total over 200", () => {
      const result = updateOrderSchema.safeParse({
        id: validUuid,
        therapies: [{ therapyId: validUuid, quantity: 201 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createCustomerOrderSchema", () => {
    test("accepts valid customer order", () => {
      const result = createCustomerOrderSchema.safeParse({
        totalAmount: 99.99,
        status: "pending",
      });
      expect(result.success).toBe(true);
    });
    test("rejects invalid Stripe session format", () => {
      const result = createCustomerOrderSchema.safeParse({
        totalAmount: 99.99,
        stripeSessionId: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateProfileSchema", () => {
    test("accepts valid profile with timezone", () => {
      const result = updateProfileSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        timezone: "America/New_York",
      });
      expect(result.success).toBe(true);
    });
    test("rejects invalid timezone", () => {
      const result = updateProfileSchema.safeParse({
        timezone: "Invalid/Zone",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("fileUploadSchema", () => {
    test("rejects filename with invalid characters", () => {
      const result = fileUploadSchema.safeParse({
        file: {
          name: "file<>name",
          size: 100,
          type: "image/png",
        },
        category: "document",
      });
      expect(result.success).toBe(false);
    });
    test("rejects filename with path traversal", () => {
      const result = fileUploadSchema.safeParse({
        file: {
          name: "../etc/passwd",
          size: 100,
          type: "image/png",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("contactMessageSchema", () => {
    test("accepts valid message with category", () => {
      const result = contactMessageSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        subject: "Hello",
        message: "This is a long enough message.",
        category: "support",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createTimeSlotSchema", () => {
    test("rejects when end time before start time", () => {
      const future = new Date(Date.now() + 86400000);
      const past = new Date(Date.now() + 86400000 * 2);
      const result = createTimeSlotSchema.safeParse({
        staffId: validUuid,
        startTime: past.toISOString(),
        endTime: future.toISOString(),
        type: "AVAILABLE",
      });
      expect(result.success).toBe(false);
    });
    test("rejects when slot exceeds 8 hours", () => {
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 9 * 60 * 60 * 1000);
      const result = createTimeSlotSchema.safeParse({
        staffId: validUuid,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        type: "AVAILABLE",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createUserSchema", () => {
    test("accepts valid user with timezone default", () => {
      const result = createUserSchema.safeParse({
        name: "User",
        email: "u@example.com",
        timezone: "UTC",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("subscriptionPortalLinkSchema", () => {
    test("accepts valid return URL", () => {
      const result = subscriptionPortalLinkSchema.safeParse({
        returnUrl: "https://example.com/return",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createAdminOrderSchema", () => {
    test("accepts valid admin order", () => {
      const result = createAdminOrderSchema.safeParse({
        userId: validUuid,
        totalAmount: 50,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateAdminOrderSchema", () => {
    test("accepts partial update", () => {
      const result = updateAdminOrderSchema.safeParse({
        id: validUuid,
        status: "completed",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateSubscriptionSchema", () => {
    test("accepts valid update", () => {
      const result = updateSubscriptionSchema.safeParse({
        subscriptionId: "sub_123",
        status: "canceled",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteAccountSchema", () => {
    test("requires confirm literal", () => {
      const result = deleteAccountSchema.safeParse({ confirm: true });
      expect(result.success).toBe(true);
    });
  });

  describe("adminVerifySchema", () => {
    test("requires non-empty adminCode", () => {
      expect(adminVerifySchema.safeParse({ adminCode: "" }).success).toBe(
        false
      );
      expect(adminVerifySchema.safeParse({ adminCode: "code" }).success).toBe(
        true
      );
    });
  });

  describe("adminSyncFirebaseSchema", () => {
    test("accepts syncAll", () => {
      const result = adminSyncFirebaseSchema.safeParse({ syncAll: true });
      expect(result.success).toBe(true);
    });
  });

  describe("webVitalsSchema", () => {
    test("accepts valid web vitals", () => {
      const result = webVitalsSchema.safeParse({
        name: "LCP",
        value: 1.5,
        url: "https://example.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("searchPerformanceSchema", () => {
    test("accepts valid search performance", () => {
      const result = searchPerformanceSchema.safeParse({
        query: "test",
        resultsCount: 10,
        responseTime: 0.5,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("formProgressSchema", () => {
    test("accepts valid form progress", () => {
      const result = formProgressSchema.safeParse({
        formId: "f1",
        step: 1,
        completed: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("formCompletionSchema", () => {
    test("accepts with optional timeSpent", () => {
      const result = formCompletionSchema.safeParse({
        formId: "f1",
        completed: true,
        timeSpent: 60,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("sendEmailSchema", () => {
    test("accepts valid email payload", () => {
      const result = sendEmailSchema.safeParse({
        to: "a@b.com",
        subject: "Hi",
        body: "Hello",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("paginationQuerySchema", () => {
    test("parses page and limit from strings", () => {
      const result = paginationQuerySchema.safeParse({
        page: "2",
        limit: "10",
        search: "q",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });
  });

  describe("deleteUserSchema", () => {
    test("accepts id and optional hardDelete", () => {
      expect(deleteUserSchema.safeParse({ id: validUuid }).success).toBe(true);
    });
  });

  describe("deleteOrderSchema", () => {
    test("accepts id and optional deletedBy", () => {
      expect(deleteOrderSchema.safeParse({ id: validUuid }).success).toBe(true);
    });
  });

  describe("deleteFileSchema", () => {
    test("requires fileId", () => {
      expect(deleteFileSchema.safeParse({ fileId: "f1" }).success).toBe(true);
      expect(deleteFileSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("usersQuerySchema", () => {
    test("transforms isActive string", () => {
      const result = usersQuerySchema.safeParse({
        role: "admin",
        isActive: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(true);
    });
  });

  describe("adminOrdersQuerySchema", () => {
    test("accepts status and userId", () => {
      const result = adminOrdersQuerySchema.safeParse({
        status: "completed",
        userId: validUuid,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("adminCustomersQuerySchema", () => {
    test("accepts role and isActive", () => {
      const result = adminCustomersQuerySchema.safeParse({
        role: "user",
        isActive: "false",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("adminSubscriptionsQuerySchema", () => {
    test("accepts status and tier", () => {
      const result = adminSubscriptionsQuerySchema.safeParse({
        status: "active",
        tier: "pro",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ordersQuerySchema", () => {
    test("accepts id and includeDeleted", () => {
      const result = ordersQuerySchema.safeParse({
        id: validUuid,
        includeDeleted: "true",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("orderBySessionQuerySchema", () => {
    test("requires session_id", () => {
      expect(
        orderBySessionQuerySchema.safeParse({ session_id: "cs_123" }).success
      ).toBe(true);
      expect(orderBySessionQuerySchema.safeParse({}).success).toBe(false);
    });
  });

  describe("totalRevenueQuerySchema", () => {
    test("accepts optional date range", () => {
      const result = totalRevenueQuerySchema.safeParse({
        dateFrom: "2024-01-01T00:00:00.000Z",
        dateTo: "2024-12-31T23:59:59.999Z",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("contactMessagesQuerySchema", () => {
    test("accepts pagination and dates", () => {
      const result = contactMessagesQuerySchema.safeParse({
        page: "1",
        limit: "20",
        dateFrom: "2024-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("reelsHistoryQuerySchema", () => {
    test("accepts type filter", () => {
      const result = reelsHistoryQuerySchema.safeParse({
        type: "reels",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("reelsUsageQuerySchema", () => {
    test("accepts type filter", () => {
      const result = reelsUsageQuerySchema.safeParse({
        type: "reels",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("reelsExportSchema", () => {
    test("accepts valid export payload", () => {
      const result = reelsExportSchema.safeParse({
        type: "reels",
        inputs: {},
        results: {},
        format: "pdf",
      });
      expect(result.success).toBe(true);
    });
  });
});
