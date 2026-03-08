/**
 * Calculator Usage Service
 *
 * Centralised business logic for querying and checking monthly calculator usage.
 * Previously this query was copy-pasted in three places:
 *   - app/api/calculator/calculate/route.ts  (limit enforcement)
 *   - app/api/calculator/usage/route.ts      (usage stats for the client)
 *   - app/api/admin/subscriptions/route.ts   (admin view)
 */

import { db } from "@/services/db/db";
import { featureUsages } from "@/infrastructure/database/drizzle/schema";
import { eq, and, notInArray, gte, sql } from "drizzle-orm";
import {
  FEATURE_TIER_REQUIREMENTS,
  isFeatureFree,
} from "@/utils/permissions/core-feature-permissions";
import { getMonthBoundaries } from "@/utils/helpers/date";

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
export async function getMonthlyUsageCount(userId: string): Promise<number> {
  const { startOfThisMonth } = getMonthBoundaries();
  const gatedTypes = getGatedCalculatorTypes();

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(featureUsages)
    .where(
      and(
        eq(featureUsages.userId, userId),
        notInArray(featureUsages.featureType, gatedTypes),
        gte(featureUsages.createdAt, startOfThisMonth),
      ),
    );
  return total;
}
