/**
 * Unit tests for PaymentService: constructor, createCheckoutSession validation
 * (missing customer/userId, no items). Full checkout flow requires mocked
 * authenticatedFetch and createProductCheckout (integration).
 */

import { describe, it, expect } from "bun:test";
import {
  PaymentService,
  type RequiredCustomerData,
} from "@/domains/payments/api/payment-service";
import type { CheckoutLineItem } from "@/domains/payments/api/stripe-checkout";

const validCustomerData: RequiredCustomerData = {
  name: "Test User",
  email: "test@example.com",
  address: "123 Main St",
  city: "City",
  state: "ST",
  zip: "12345",
};

const sampleLineItem: CheckoutLineItem = {
  price_data: {
    currency: "usd",
    product_data: { name: "Product", description: "Desc" },
    unit_amount: 1000,
  },
  quantity: 1,
};

describe("PaymentService", () => {
  describe("constructor", () => {
    it("creates instance with userId, lineItems, subtotal", () => {
      const svc = new PaymentService("user-1", [sampleLineItem], 1000);
      expect(svc).toBeDefined();
    });
  });

  describe("createCheckoutSession", () => {
    it("returns error when customerData is missing", async () => {
      const svc = new PaymentService("user-1", [sampleLineItem], 1000);
      const result = await svc.createCheckoutSession(
        null as unknown as RequiredCustomerData
      );
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Missing customer");
    });

    it("returns error when userId is empty", async () => {
      const svc = new PaymentService("", [sampleLineItem], 1000);
      const result = await svc.createCheckoutSession(validCustomerData);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Missing customer");
    });

    it("returns error when lineItems is empty", async () => {
      const svc = new PaymentService("user-1", [], 0);
      const result = await svc.createCheckoutSession(validCustomerData);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("No items");
    });
  });

  describe("processPayment", () => {
    it("throws when createCheckoutSession returns error", async () => {
      const svc = new PaymentService("user-1", [], 0);
      await expect(svc.processPayment(validCustomerData)).rejects.toThrow();
    });
  });
});
