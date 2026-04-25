import { z } from "zod";

export const SUBSCRIPTION_TIERS = {
  BASIC: "basic",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;

export const SUBSCRIPTION_TRIAL_DAYS = 14;

export type SubscriptionTier =
  (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired";

export interface SubscriptionTierFeatures {
  maxReelsPerMonth: number;
  maxGenerationsPerMonth: number;
  maxAnalysesPerMonth: number;
  maxQueueItems: number;
  aiAnalysis: boolean;
  instagramPublishing: boolean;
  supportLevel: "email" | "priority" | "dedicated";
  apiAccess: boolean;
  customBranding: boolean;
}

export interface SubscriptionTierConfig {
  name: string;
  price: number;
  billingCycle: "monthly" | "annual";
  features: SubscriptionTierFeatures;
  stripePriceId: string;
}

export const FREE_TIER_LIMITS = {
  maxGenerationsPerMonth: 10,
  maxAnalysesPerMonth: 5,
} as const;

export const BASE_TIER_FEATURES: Record<
  SubscriptionTier,
  SubscriptionTierFeatures
> = {
  [SUBSCRIPTION_TIERS.BASIC]: {
    maxReelsPerMonth: 100,
    maxGenerationsPerMonth: 100,
    maxAnalysesPerMonth: 50,
    maxQueueItems: 10,
    aiAnalysis: true,
    instagramPublishing: false,
    supportLevel: "email",
    apiAccess: false,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    maxReelsPerMonth: -1,
    maxGenerationsPerMonth: 500,
    maxAnalysesPerMonth: 200,
    maxQueueItems: 100,
    aiAnalysis: true,
    instagramPublishing: true,
    supportLevel: "priority",
    apiAccess: false,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    maxReelsPerMonth: -1,
    maxGenerationsPerMonth: -1,
    maxAnalysesPerMonth: -1,
    maxQueueItems: -1,
    aiAnalysis: true,
    instagramPublishing: true,
    supportLevel: "dedicated",
    apiAccess: true,
    customBranding: true,
  },
};

export const TIER_NAMES: Record<SubscriptionTier, string> = {
  [SUBSCRIPTION_TIERS.BASIC]: "Creator",
  [SUBSCRIPTION_TIERS.PRO]: "Pro",
  [SUBSCRIPTION_TIERS.ENTERPRISE]: "Agency",
};

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
  resetDate: Date | string | null;
  percentageUsed: number;
  isLimitReached: boolean;
  limitReached?: boolean;
}

export interface SubscriptionBillingInfo {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextBillingDate: Date | null;
  amount: number;
  currency: string;
  cancelAtPeriodEnd: boolean;
}

export const subscriptionBillingCycleSchema = z.enum(["monthly", "annual"]);
