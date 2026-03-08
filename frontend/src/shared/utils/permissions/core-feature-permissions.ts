/**
 * Core feature permissions – topic-agnostic access control.
 *
 * Used for the main app feature (default: calculators). Tier requirements
 * come from the feature config (e.g. calculator.constants.ts). Use these
 * names in template-agnostic code; the default implementation uses
 * calculation types as feature types.
 */

import { SubscriptionTier } from "@/shared/constants/subscription.constants";
import {
  CALCULATOR_TIER_REQUIREMENTS,
  type CalculationType,
  isCalculatorFree as isFreeFromConfig,
  getCalculatorsForTier,
} from "@/features/calculator/constants/calculator.constants";

/** Feature type for the default implementation (calculator types). */
export type FeatureType = CalculationType;

/** Tier requirements per feature type (from config). Default: calculator types. */
export const FEATURE_TIER_REQUIREMENTS = CALCULATOR_TIER_REQUIREMENTS;

/** Get the required tier for a feature type. null = free (not gated). */
export function getRequiredTierForFeature(
  featureType: FeatureType
): SubscriptionTier | null {
  return FEATURE_TIER_REQUIREMENTS[featureType];
}

/** Check if a feature type is free (not gated). */
export function isFeatureFree(featureType: FeatureType): boolean {
  return isFreeFromConfig(featureType);
}

/** Check if a user tier has access to a feature type. */
export function hasFeatureAccess(
  userTier: SubscriptionTier | null | undefined,
  featureType: FeatureType
): boolean {
  const requiredTier = FEATURE_TIER_REQUIREMENTS[featureType];
  if (requiredTier === null) return true;
  if (!userTier) return false;
  return hasTierAccess(userTier, requiredTier);
}

/** Check if user tier meets required tier (hierarchy: Enterprise > Pro > Basic). */
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

/** Get all feature types accessible to a user tier. */
export function getAccessibleFeatures(
  userTier: SubscriptionTier | null | undefined
): FeatureType[] {
  if (!userTier) {
    return (Object.keys(FEATURE_TIER_REQUIREMENTS) as FeatureType[]).filter(
      (t) => isFeatureFree(t)
    );
  }
  return getCalculatorsForTier(userTier);
}
