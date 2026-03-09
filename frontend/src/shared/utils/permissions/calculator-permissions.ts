/**
 * Calculator permissions — stub for backward compatibility.
 * Calculator feature removed; imports re-exported from core-feature-permissions.
 */

import type { FeatureType } from "./core-feature-permissions";
import {
  getRequiredTierForFeature,
  isFeatureFree,
  hasFeatureAccess,
  hasTierAccess,
  getAccessibleFeatures,
} from "./core-feature-permissions";

export type { FeatureType as CalculationType, FeatureType as CalculatorType };

export const getRequiredTierForCalculator = getRequiredTierForFeature;
export const hasCalculatorAccess = (
  userTier: Parameters<typeof hasFeatureAccess>[0],
  calculatorType: FeatureType,
) => hasFeatureAccess(userTier, calculatorType);
export { isFeatureFree, hasTierAccess };
export const getAccessibleCalculators = getAccessibleFeatures;
