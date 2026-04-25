import { z } from "zod";
import {
  type SubscriptionTier,
  subscriptionBillingCycleSchema,
} from "./subscription";

export const createCheckoutSessionBodySchema = z.object({
  priceId: z.string().trim().min(1),
  tier: z.string().trim().min(1).optional(),
  billingCycle: subscriptionBillingCycleSchema.optional(),
  trialEnabled: z.boolean().optional().default(false),
});

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

export type PaymentSuccessType = "subscription" | "order";

export interface PaymentSuccessParams {
  type?: PaymentSuccessType;
  session_id?: string;
  order_id?: string;
}

export interface SubscriptionSuccessData {
  sessionId: string;
  tier?: string;
  billingCycle?: string;
}

export interface OrderSuccessData {
  sessionId: string;
  orderId: string;
}
