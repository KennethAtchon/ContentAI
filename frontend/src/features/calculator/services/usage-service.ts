/**
 * Calculator Usage Service
 *
 * Centralised business logic for querying and checking monthly calculator usage.
 * Previously this query was copy-pasted in three places:
 *   - app/api/calculator/calculate/route.ts  (limit enforcement)
 *   - app/api/calculator/usage/route.ts      (usage stats for the client)
 *   - app/api/admin/subscriptions/route.ts   (admin view)
 */

import {
  FEATURE_TIER_REQUIREMENTS,
  isFeatureFree,
} from "@/shared/utils/permissions/core-feature-permissions";
import { debugLog } from "@/shared/utils/debug";

/**
 * Returns the list of gated (non-free) calculator feature keys.
 * These are the only ones that count toward monthly usage limits.
 */
export function getGatedCalculatorTypes(): string[] {
  return (
    Object.keys(FEATURE_TIER_REQUIREMENTS) as Array<
      keyof typeof FEATURE_TIER_REQUIREMENTS
    >
  ).filter((calc) => !isFeatureFree(calc));
}

/**
 * Returns the number of gated calculator uses for a user in the current
 * calendar month. Free calculators are excluded from the count.
 */
export async function getMonthlyUsageCount(_userId: string): Promise<number> {
  try {
    // This would need to be refactored to use the proper fetcher
    // For now, returning 0 as placeholder
    debugLog.warn("getMonthlyUsageCount called but not properly implemented");
    return 0;
  } catch (error) {
    debugLog.warn("Error in getMonthlyUsageCount", { error });
    return 0;
  }
}
