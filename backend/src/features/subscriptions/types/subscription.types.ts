/**
 * Subscription Types
 *
 * TypeScript types for subscription-related data structures.
 */

import {
  SubscriptionTier,
  SubscriptionStatus,
} from "@/constants/subscription.constants";

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  usageCount: number;
  usageLimit: number | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionRequest {
  tier: SubscriptionTier;
  paymentMethodId?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionRequest {
  tier?: SubscriptionTier;
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionUsageStats {
  currentUsage: number;
  usageLimit: number | null;
  resetDate: Date | null;
  percentageUsed: number;
  isLimitReached: boolean;
}

export interface SubscriptionBillingInfo {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextBillingDate: Date | null;
  amount: number;
  currency: string;
  cancelAtPeriodEnd: boolean;
}
