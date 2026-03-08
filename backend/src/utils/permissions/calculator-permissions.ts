/**
 * Calculator permissions – re-exports from core-feature-permissions with
 * calculator-specific names for backward compatibility.
 *
 * New code should import from core-feature-permissions and use
 * hasFeatureAccess, isFeatureFree, getRequiredTierForFeature, etc.
 */

import type { FeatureType } from "./core-feature-permissions";
import {
  FEATURE_TIER_REQUIREMENTS,
  getRequiredTierForFeature,
  isFeatureFree,
  hasFeatureAccess,
  hasTierAccess,
  getAccessibleFeatures,
} from "./core-feature-permissions";

export const CALCULATOR_TIER_REQUIREMENTS = FEATURE_TIER_REQUIREMENTS;
export type { FeatureType as CalculationType, FeatureType as CalculatorType };

export const getRequiredTierForCalculator = getRequiredTierForFeature;
export const hasCalculatorAccess = (
  userTier: Parameters<typeof hasFeatureAccess>[0],
  calculatorType: FeatureType,
) => hasFeatureAccess(userTier, calculatorType);
export { isFeatureFree, hasTierAccess };
export const getAccessibleCalculators = getAccessibleFeatures;
