/**
 * Comprehensive Input Validation Tests
 *
 * Tests for production-readiness checklist items:
 * - Verify all user inputs are validated (Zod schemas)
 * - Test SQL injection prevention (Prisma handles this, but verify)
 * - Test XSS prevention
 * - Verify file upload validation and sanitization
 */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  contactFormValidationSchema,
  validateContactField,
} from "@/utils/validation/contact-validation";
import {
  checkoutValidationSchema,
  validateField,
} from "@/utils/validation/checkout-validation";
import {
  createOrderSchema,
  fileUploadSchema,
  validateInput,
} from "@/utils/validation/api-validation";
import {
  validateFile,
  generateSecureFilename,
} from "@/utils/validation/file-validation";

describe("Input Validation Tests - Production Readiness", () => {
  describe("1. Zod Schema Validation", () => {
    describe("Contact Form Validation", () => {
      test("should accept valid contact form data", () => {
        const validData = {
          name: "John Doe",
          email: "john@example.com",
          phone: "+1 (555) 123-4567",
          subject: "general",
          message: "This is a valid message with enough characters.",
        };

        const result = contactFormValidationSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe("John Doe");
          expect(result.data.email).toBe("john@example.com");
        }
      });

      test("should reject invalid email formats", () => {
        const invalidEmails = [
          "not-an-email",
          "@example.com",
          "user@",
          "user@domain",
          "user..name@example.com",
          "user@domain..com",
        ];

        invalidEmails.forEach((email) => {
          const result = contactFormValidationSchema.safeParse({
            name: "Test User",
            email,
            message: "Valid message with enough characters.",
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(
              result.error.issues.some((issue) => issue.path.includes("email")),
            ).toBe(true);
          }
        });
      });

      test("should reject names with invalid characters", () => {
        const invalidNames = [
          "John<script>alert('xss')</script>",
          "John'; DROP TABLE users;--",
          "John<img src=x onerror=alert(1)>",
          "John<div>",
        ];

        invalidNames.forEach((name) => {
          const result = contactFormValidationSchema.safeParse({
            name,
            email: "test@example.com",
            message: "Valid message with enough characters.",
          });
          expect(result.success).toBe(false);
        });
      });

      test("should reject messages that are too short", () => {
        const result = contactFormValidationSchema.safeParse({
          name: "John Doe",
          email: "john@example.com",
          message: "Short", // Less than 10 characters
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          const messageError = result.error.issues.find((issue) =>
            issue.path.includes("message"),
          );
          expect(messageError).toBeDefined();
        }
      });

      test("should reject messages that are too long", () => {
        const longMessage = "a".repeat(5001); // Exceeds 5000 character limit

        const result = contactFormValidationSchema.safeParse({
          name: "John Doe",
          email: "john@example.com",
          message: longMessage,
        });

        expect(result.success).toBe(false);
      });
    });

    describe("Checkout Form Validation", () => {
      test("should accept valid checkout data", () => {
        const validData = {
          name: "Jane Smith",
          email: "jane@example.com",
          phone: "5551234567",
          contactMethod: "email" as const,
          address: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
          agreeToTerms: true,
        };

        const result = checkoutValidationSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      test("should reject invalid US state codes", () => {
        const invalidStates = ["XX", "12", "ca", "CALIFORNIA"];

        invalidStates.forEach((state) => {
          const result = checkoutValidationSchema.safeParse({
            name: "Test User",
            email: "test@example.com",
            phone: "5551234567",
            contactMethod: "email" as const,
            address: "123 Main St",
            city: "San Francisco",
            state,
            zip: "94102",
            agreeToTerms: true,
          });
          expect(result.success).toBe(false);
        });
      });

      test("should reject invalid ZIP codes", () => {
        const invalidZips = ["1234", "12345678901", "ABCDE", "12345-12345"];

        invalidZips.forEach((zip) => {
          const result = checkoutValidationSchema.safeParse({
            name: "Test User",
            email: "test@example.com",
            phone: "5551234567",
            contactMethod: "email" as const,
            address: "123 Main St",
            city: "San Francisco",
            state: "CA",
            zip,
            agreeToTerms: true,
          });
          expect(result.success).toBe(false);
        });
      });
    });

    describe("API Validation Schemas", () => {
      test("should validate order creation schema", () => {
        const validOrder = {
          therapies: [
            {
              therapyId: "123e4567-e89b-12d3-a456-426614174000",
              quantity: 2,
            },
          ],
          stripeSessionId: "cs_test_1234567890",
          skipPayment: false,
        };

        const result = createOrderSchema.safeParse(validOrder);
        expect(result.success).toBe(true);
      });

      test("should reject orders with invalid UUIDs", () => {
        const invalidOrder = {
          therapies: [
            {
              therapyId: "not-a-uuid",
              quantity: 2,
            },
          ],
        };

        const result = createOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
      });

      test("should reject orders with SQL injection attempts in UUIDs", () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE orders;--",
          "1' OR '1'='1",
          "1'; DELETE FROM orders;--",
        ];

        sqlInjectionAttempts.forEach((maliciousId) => {
          const result = createOrderSchema.safeParse({
            therapies: [
              {
                therapyId: maliciousId,
                quantity: 1,
              },
            ],
          });
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe("2. SQL Injection Prevention", () => {
    test("should reject SQL injection attempts in name fields", () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users;--",
        "1' OR '1'='1",
        "admin'--",
        "'; DELETE FROM users WHERE '1'='1",
        "1'; UPDATE users SET role='admin' WHERE id=1;--",
      ];

      sqlInjectionAttempts.forEach((maliciousInput) => {
        // Test contact form
        const contactResult = contactFormValidationSchema.safeParse({
          name: maliciousInput,
          email: "test@example.com",
          message: "Valid message with enough characters.",
        });
        expect(contactResult.success).toBe(false);

        // Test checkout form
        const checkoutResult = checkoutValidationSchema.safeParse({
          name: maliciousInput,
          email: "test@example.com",
          phone: "5551234567",
          contactMethod: "email" as const,
          address: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
          agreeToTerms: true,
        });
        expect(checkoutResult.success).toBe(false);
      });
    });

    test("should reject SQL injection attempts in email fields", () => {
      const sqlInjectionAttempts = [
        "test@example.com'; DROP TABLE users;--",
        "test'@example.com",
        "test@example.com'; DELETE FROM users;--",
      ];

      sqlInjectionAttempts.forEach((maliciousEmail) => {
        const result = contactFormValidationSchema.safeParse({
          name: "Test User",
          email: maliciousEmail,
          message: "Valid message with enough characters.",
        });
        expect(result.success).toBe(false);
      });
    });

    test("should reject SQL injection attempts in message fields", () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE contact_messages;--",
        "1' OR '1'='1",
        "'; DELETE FROM contact_messages WHERE '1'='1",
      ];

      sqlInjectionAttempts.forEach((maliciousMessage) => {
        // Ensure message is long enough to pass minimum length check
        const longMaliciousMessage = maliciousMessage + " " + "a".repeat(20);
        const result = contactFormValidationSchema.safeParse({
          name: "Test User",
          email: "test@example.com",
          message: longMaliciousMessage,
        });
        // Message should be rejected due to invalid characters or sanitized
        // The validation should prevent dangerous SQL characters
        expect(result.success).toBe(false);
      });
    });

    test("should validate that Prisma parameterized queries prevent SQL injection", () => {
      // This test documents that Prisma uses parameterized queries
      // We can't directly test Prisma's internal behavior, but we verify
      // that our validation schemas reject SQL injection patterns

      const maliciousInputs = [
        "'; DROP TABLE users;--",
        "1' OR '1'='1",
        "admin'--",
      ];

      maliciousInputs.forEach((input) => {
        // All these should be rejected by Zod validation before reaching Prisma
        const result = contactFormValidationSchema.safeParse({
          name: input,
          email: "test@example.com",
          message: "Valid message with enough characters.",
        });
        expect(result.success).toBe(false);
      });

      // Note: Even if validation passes, Prisma's parameterized queries
      // would prevent SQL injection, but validation is the first line of defense
    });
  });

  describe("3. XSS Prevention", () => {
    test("should reject XSS attempts in name fields", () => {
      const xssAttempts = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg onload=alert(1)>",
        "javascript:alert(1)",
        "<iframe src=javascript:alert(1)>",
        "<body onload=alert('XSS')>",
        "<input onfocus=alert(1) autofocus>",
      ];

      xssAttempts.forEach((xssPayload) => {
        // Contact form
        const contactResult = contactFormValidationSchema.safeParse({
          name: xssPayload,
          email: "test@example.com",
          message: "Valid message with enough characters.",
        });
        expect(contactResult.success).toBe(false);

        // Checkout form
        const checkoutResult = checkoutValidationSchema.safeParse({
          name: xssPayload,
          email: "test@example.com",
          phone: "5551234567",
          contactMethod: "email" as const,
          address: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
          agreeToTerms: true,
        });
        expect(checkoutResult.success).toBe(false);
      });
    });

    test("should reject XSS attempts in email fields", () => {
      const xssAttempts = [
        "<script>alert('XSS')</script>@example.com",
        "test<script>@example.com",
        "test@<script>example.com",
      ];

      xssAttempts.forEach((xssEmail) => {
        const result = contactFormValidationSchema.safeParse({
          name: "Test User",
          email: xssEmail,
          message: "Valid message with enough characters.",
        });
        expect(result.success).toBe(false);
      });
    });

    test("should reject XSS attempts in message fields", () => {
      const xssAttempts = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg onload=alert(1)>",
        "javascript:alert(1)",
      ];

      xssAttempts.forEach((xssPayload) => {
        // Make sure message is long enough
        const longXssMessage = xssPayload + " " + "a".repeat(20);
        const result = contactFormValidationSchema.safeParse({
          name: "Test User",
          email: "test@example.com",
          message: longXssMessage,
        });
        // XSS attempts should be rejected by validation
        expect(result.success).toBe(false);
      });
    });

    test("should sanitize and reject HTML entities used for XSS", () => {
      const htmlEntityXss = [
        "&lt;script&gt;alert('XSS')&lt;/script&gt;",
        "&#60;script&#62;alert('XSS')&#60;/script&#62;",
        "&#x3C;script&#x3E;alert('XSS')&#x3C;/script&#x3E;",
      ];

      htmlEntityXss.forEach((xssPayload) => {
        const result = contactFormValidationSchema.safeParse({
          name: xssPayload,
          email: "test@example.com",
          message: "Valid message with enough characters.",
        });
        // Should be rejected due to invalid characters in name regex
        expect(result.success).toBe(false);
      });
    });
  });

  describe("4. File Upload Validation and Sanitization", () => {
    test("should accept valid image files", async () => {
      // Create a mock valid PNG file
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const file = new File([pngSignature], "test.png", {
        type: "image/png",
      });

      const result = await validateFile(file, {
        maxSizeBytes: 10 * 1024 * 1024,
        allowedTypes: [".png"],
        allowedMimeTypes: ["image/png"],
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test("should reject files that are too large", async () => {
      const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      });

      const result = await validateFile(largeFile, {
        maxSizeBytes: 10 * 1024 * 1024, // 10MB limit
        allowedTypes: [".jpg"],
        allowedMimeTypes: ["image/jpeg"],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("exceeds"))).toBe(true);
    });

    test("should reject files with disallowed MIME types", async () => {
      const maliciousFile = new File(["malicious content"], "test.exe", {
        type: "application/x-msdownload", // Executable file
      });

      const result = await validateFile(maliciousFile, {
        maxSizeBytes: 10 * 1024 * 1024,
        allowedTypes: [".jpg", ".png"],
        allowedMimeTypes: ["image/jpeg", "image/png"],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("not allowed"))).toBe(true);
    });

    test("should reject files with mismatched file signatures", async () => {
      // Create a file that claims to be PNG but has JPEG signature
      const jpegSignature = new Uint8Array([0xff, 0xd8, 0xff]);
      const fakePngFile = new File([jpegSignature], "fake.png", {
        type: "image/png",
      });

      const result = await validateFile(fakePngFile, {
        maxSizeBytes: 10 * 1024 * 1024,
        allowedTypes: [".png"],
        allowedMimeTypes: ["image/png"],
      });

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("does not match declared MIME type"),
        ),
      ).toBe(true);
    });

    test("should sanitize dangerous filenames", async () => {
      const dangerousFilenames = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32",
        "<script>alert('xss')</script>.jpg",
        "file\0name.jpg",
        "file:name.jpg",
        "file|name.jpg",
        "file?name.jpg",
        "file*name.jpg",
      ];

      for (const dangerousName of dangerousFilenames) {
        const file = new File(["content"], dangerousName, {
          type: "image/jpeg",
        });

        const result = await validateFile(file, {
          maxSizeBytes: 10 * 1024 * 1024,
          allowedTypes: [".jpg"],
          allowedMimeTypes: ["image/jpeg"],
        });

        // Filename should be sanitized
        expect(result.sanitizedFilename).toBeDefined();
        expect(result.sanitizedFilename).not.toContain("..");
        expect(result.sanitizedFilename).not.toContain("<");
        expect(result.sanitizedFilename).not.toContain(">");
        expect(result.sanitizedFilename).not.toContain("\0");
      }
    });

    test("should generate secure filenames", () => {
      const dangerousNames = [
        "../../../etc/passwd",
        "<script>alert('xss')</script>.jpg",
        "file\0name.jpg",
      ];

      dangerousNames.forEach((dangerousName) => {
        const secureName = generateSecureFilename(dangerousName, "prefix");
        expect(secureName).not.toContain("..");
        expect(secureName).not.toContain("<");
        expect(secureName).not.toContain(">");
        expect(secureName).not.toContain("\0");
        expect(secureName).toMatch(/^prefix_\d+_[a-z0-9]+\.jpg$/);
      });
    });

    test("should validate file upload schema", () => {
      const validFileUpload = {
        file: {
          name: "test.jpg",
          size: 1024 * 1024, // 1MB
          type: "image/jpeg",
        },
        category: "therapy_image",
      };

      const result = fileUploadSchema.safeParse(validFileUpload);
      expect(result.success).toBe(true);
    });

    test("should reject file uploads with invalid filenames", () => {
      const invalidFilenames = [
        "../../../etc/passwd",
        "<script>.jpg",
        "file\0name.jpg",
        "file:name.jpg",
      ];

      invalidFilenames.forEach((filename) => {
        const result = fileUploadSchema.safeParse({
          file: {
            name: filename,
            size: 1024,
            type: "image/jpeg",
          },
        });
        expect(result.success).toBe(false);
      });
    });

    test("should reject file uploads that are too large", () => {
      const result = fileUploadSchema.safeParse({
        file: {
          name: "test.jpg",
          size: 11 * 1024 * 1024, // 11MB (exceeds 10MB limit)
          type: "image/jpeg",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("5. Field-Level Validation Functions", () => {
    test("should validate contact form fields individually", () => {
      // Valid name
      const validName = validateContactField.name("John Doe");
      expect(validName.isValid).toBe(true);
      expect(validName.error).toBeNull();

      // Invalid name
      const invalidName = validateContactField.name(
        "<script>alert('xss')</script>",
      );
      expect(invalidName.isValid).toBe(false);
      expect(invalidName.error).toBeDefined();

      // Valid email
      const validEmail = validateContactField.email("test@example.com");
      expect(validEmail.isValid).toBe(true);

      // Invalid email
      const invalidEmail = validateContactField.email("not-an-email");
      expect(invalidEmail.isValid).toBe(false);
    });

    test("should validate checkout form fields individually", () => {
      // Valid state
      const validState = validateField.state("CA");
      expect(validState.isValid).toBe(true);

      // Invalid state
      const invalidState = validateField.state("XX");
      expect(invalidState.isValid).toBe(false);

      // Valid ZIP
      const validZip = validateField.zip("94102");
      expect(validZip.isValid).toBe(true);

      // Invalid ZIP
      const invalidZip = validateField.zip("1234");
      expect(invalidZip.isValid).toBe(false);
    });
  });

  describe("6. Edge Cases and Boundary Testing", () => {
    test("should handle maximum length inputs", () => {
      const maxLengthName = "a".repeat(100); // Exactly 100 characters
      const result = contactFormValidationSchema.safeParse({
        name: maxLengthName,
        email: "test@example.com",
        subject: "general",
        message: "Valid message with enough characters.",
      });
      expect(result.success).toBe(true);

      const tooLongName = "a".repeat(101); // Exceeds 100 characters
      const tooLongResult = contactFormValidationSchema.safeParse({
        name: tooLongName,
        email: "test@example.com",
        subject: "general",
        message: "Valid message with enough characters.",
      });
      expect(tooLongResult.success).toBe(false);
    });

    test("should handle minimum length inputs", () => {
      const minLengthMessage = "a".repeat(10); // Exactly 10 characters
      const result = contactFormValidationSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        subject: "general",
        message: minLengthMessage,
      });
      expect(result.success).toBe(true);

      const tooShortMessage = "a".repeat(9); // Less than 10 characters
      const tooShortResult = contactFormValidationSchema.safeParse({
        name: "Test User",
        email: "test@example.com",
        subject: "general",
        message: tooShortMessage,
      });
      expect(tooShortResult.success).toBe(false);
    });

    test("should handle empty strings appropriately", () => {
      const result = contactFormValidationSchema.safeParse({
        name: "",
        email: "test@example.com",
        message: "Valid message with enough characters.",
      });
      expect(result.success).toBe(false);
    });

    test("should handle whitespace-only inputs", () => {
      const result = contactFormValidationSchema.safeParse({
        name: "   ",
        email: "test@example.com",
        message: "Valid message with enough characters.",
      });
      // Name should be trimmed and then fail validation
      expect(result.success).toBe(false);
    });
  });

  describe("7. validateInput Helper Function", () => {
    test("should return success for valid input", () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const result = validateInput(
        schema,
        {
          name: "Test User",
          email: "test@example.com",
        },
        "test-context",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test User");
        expect(result.data.email).toBe("test@example.com");
      }
    });

    test("should return detailed error information for invalid input", () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      const result = validateInput(
        schema,
        {
          name: "",
          email: "not-an-email",
        },
        "test-context",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
        expect(Array.isArray(result.details)).toBe(true);
      }
    });
  });
});
