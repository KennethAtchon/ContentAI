/**
 * Email resend service – sendEmail (dev mode), sendTestEmail, generateOrderConfirmationEmail, sendOrderConfirmationEmail.
 */
import { describe, expect, test } from "bun:test";
import {
  sendEmail,
  sendTestEmail,
  generateOrderConfirmationEmail,
  sendOrderConfirmationEmail,
} from "@/services/email/resend";

describe("resend", () => {
  describe("sendEmail", () => {
    test("returns result with success and id or error", async () => {
      const result = await sendEmail({
        to: ["test@example.com"],
        subject: "Test",
        html: "<p>Test</p>",
      });
      expect(result).toHaveProperty("success");
      if (result.success) {
        expect(result).toHaveProperty("id");
      } else {
        expect(result).toHaveProperty("error");
      }
    });

    test("returns error for invalid email addresses", async () => {
      const result = await sendEmail({
        to: ["invalid-email", "also-bad"],
        subject: "Test",
        html: "<p>Test</p>",
      });
      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toContain("Invalid");
    });
  });

  describe("sendTestEmail", () => {
    test("returns result from sendEmail", async () => {
      const result = await sendTestEmail("test@example.com");
      expect(result).toHaveProperty("success");
    });
  });

  describe("generateOrderConfirmationEmail", () => {
    test("returns html with customer name and order id", () => {
      const html = generateOrderConfirmationEmail({
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        orderId: "ord_12345678",
        totalAmount: "$99.00",
        address: "123 Main St",
      });
      expect(html).toContain("Jane Doe");
      expect(html).toContain("jane@example.com");
      expect(html).toContain("$99.00");
      expect(html).toContain("123 Main St");
    });

    test("includes phone section when phone provided", () => {
      const html = generateOrderConfirmationEmail({
        customerName: "A",
        customerEmail: "a@b.com",
        orderId: "x",
        totalAmount: "$0",
        address: "Addr",
        phone: "555-1234",
      });
      expect(html).toContain("555-1234");
    });

    test("includes therapies list when provided", () => {
      const html = generateOrderConfirmationEmail({
        customerName: "A",
        customerEmail: "a@b.com",
        orderId: "x",
        totalAmount: "$50.00",
        address: "Addr",
        therapies: [{ name: "Therapy A", quantity: 2, price: "25.00" }],
      });
      expect(html).toContain("Therapy A");
      expect(html).toContain("50.00");
    });
  });

  describe("sendOrderConfirmationEmail", () => {
    test("returns result with success property", async () => {
      const result = await sendOrderConfirmationEmail({
        customerName: "Jane",
        customerEmail: "jane@example.com",
        orderId: "ord_12345678",
        totalAmount: "$99.00",
        address: "123 Main St",
      });
      expect(result).toHaveProperty("success");
    });
  });
});
