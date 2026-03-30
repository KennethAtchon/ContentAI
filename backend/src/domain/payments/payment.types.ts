import type { SubscriptionTier } from "../../constants/subscription.constants";

export interface CreateCheckoutRequest {
  priceId: string;
  tier: SubscriptionTier;
  billingCycle: "monthly" | "annual";
  trialEnabled?: boolean;
}

export interface CheckoutSession {
  url: string | null;
  sessionId: string;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  sessionId?: string;
  error?: string;
}

export interface PortalLinkRequest {
  returnUrl?: string;
}

export interface PortalLinkResult {
  url: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
}
