/**
 * Core feature permissions — subscription tier gating.
 * Calculator-specific logic removed; studio features use tier checks directly.
 */

import { SubscriptionTier } from "@/shared/constants/subscription.constants";

export type FeatureType = "studio" | "generation" | "queue" | "publishing";

const FEATURE_TIER_REQUIREMENTS: Record<FeatureType, SubscriptionTier | null> =
  {
    studio: null, // free
    generation: null, // free (rate-limited)
    queue: null, // free (5-item cap enforced server-side)
    publishing: "pro", // automated publishing = Pro
  };

export function getRequiredTierForFeature(
  featureType: FeatureType
): SubscriptionTier | null {
  return FEATURE_TIER_REQUIREMENTS[featureType];
}

export function isFeatureFree(featureType: FeatureType): boolean {
  return FEATURE_TIER_REQUIREMENTS[featureType] === null;
}

export function hasFeatureAccess(
  userTier: SubscriptionTier | null | undefined,
  featureType: FeatureType
): boolean {
  const requiredTier = FEATURE_TIER_REQUIREMENTS[featureType];
  if (requiredTier === null) return true;
  if (!userTier) return false;
  return hasTierAccess(userTier, requiredTier);
}

export function hasTierAccess(
  userTier: SubscriptionTier | null | undefined,
  requiredTier: SubscriptionTier
): boolean {
  if (!userTier) return false;
  const tierHierarchy: Record<SubscriptionTier, number> = {
    basic: 1,
    pro: 2,
    enterprise: 3,
  };
  return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
}

export function getAccessibleFeatures(
  userTier: SubscriptionTier | null | undefined
): FeatureType[] {
  return (Object.keys(FEATURE_TIER_REQUIREMENTS) as FeatureType[]).filter((f) =>
    hasFeatureAccess(userTier, f)
  );
}
