import { authenticatedFetch } from "@/shared/api/authenticated-fetch";
import { debugLog } from "@/shared/debug";
import { createProductCheckout, CheckoutLineItem } from "./stripe-checkout";

const SERVICE_NAME = "payment-service";

export interface RequiredCustomerData {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  contactMethod?: string;
}

export interface PaymentServiceOptions {
  successUrl?: string;
  cancelUrl?: string;
  collectShippingAddress?: boolean;
  allowPromotionCodes?: boolean;
}

export class PaymentService {
  private readonly userId: string;
  private readonly lineItems: CheckoutLineItem[];
  private readonly subtotal: number;

  constructor(userId: string, lineItems: CheckoutLineItem[], subtotal: number) {
    this.userId = userId;
    this.lineItems = lineItems;
    this.subtotal = subtotal;
  }

  async updateCustomerProfile(
    customerData: RequiredCustomerData
  ): Promise<void> {
    const fullAddress = `${customerData.address}, ${customerData.city}, ${customerData.state} ${customerData.zip}`;

    await authenticatedFetch("/api/customer/profile", {
      method: "PUT",
      body: JSON.stringify({
        name: customerData.name,
        phone: customerData.phone,
        address: fullAddress,
      }),
    });
  }

  async createCheckoutSession(
    customerData: RequiredCustomerData,
    options: PaymentServiceOptions = {}
  ): Promise<{ url?: string; error?: Error }> {
    // Validate inputs
    if (!customerData || !this.userId) {
      return { error: new Error("Missing customer or authentication data") };
    }

    if (this.lineItems.length === 0) {
      return { error: new Error("No items to purchase") };
    }

    try {
      // Update customer profile first
      await this.updateCustomerProfile(customerData);

      // Create success URL with session ID placeholder
      const baseSuccessUrl =
        options.successUrl || `${window.location.origin}/payment/success`;
      const successUrl = `${baseSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`;

      // Create checkout session
      const result = await createProductCheckout(this.userId, this.lineItems, {
        success_url: successUrl,
        cancel_url:
          options.cancelUrl || `${window.location.origin}/payment/cancel`,
        collect_shipping_address: options.collectShippingAddress || false,
        allow_promotion_codes: options.allowPromotionCodes || false,
        metadata: {
          userId: this.userId,
          orderData: JSON.stringify(customerData),
          totalAmount: this.subtotal.toString(),
          customerName: customerData.name,
          customerEmail: customerData.email,
          customerPhone: customerData.phone || "",
          customerAddress: `${customerData.address}, ${customerData.city}, ${customerData.state} ${customerData.zip}`,
          contactMethod: customerData.contactMethod || "",
        },
      });

      return result;
    } catch (error) {
      debugLog.error("Payment service error", { service: SERVICE_NAME }, error);
      return {
        error:
          error instanceof Error ? error : new Error("Unknown payment error"),
      };
    }
  }

  async processPayment(
    customerData: RequiredCustomerData,
    options?: PaymentServiceOptions
  ): Promise<void> {
    const result = await this.createCheckoutSession(customerData, options);

    if (result.error) {
      throw result.error;
    }

    if (result.url) {
      window.location.assign(result.url);
    } else {
      throw new Error("No checkout URL received");
    }
  }
}
