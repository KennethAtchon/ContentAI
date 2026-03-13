import type { MiddlewareHandler } from "hono";
import type { HonoEnv } from "./protection";
import { db } from "../services/db/db";
import { featureUsages } from "../infrastructure/database/drizzle/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getFeatureLimitsForStripeRole } from "../constants/subscription.constants";
import { debugLog } from "../utils/debug/debug";

type GatedFeature = "generation" | "analysis";

/**
 * Usage gate middleware. Checks the user's current-month usage against their
 * tier limit and returns 403 USAGE_LIMIT_REACHED if exceeded.
 *
 * - "generation": counts featureUsages rows with featureType = "generation"
 * - "analysis":   counts featureUsages rows with featureType = "reel_analysis"
 *
 * Must be placed after authMiddleware so c.get("auth") is available.
 */
export function usageGate(feature: GatedFeature): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    try {
      const auth = c.get("auth");
      const userId = auth.user.id;
      const stripeRole = auth.firebaseUser.stripeRole;

      const limits = getFeatureLimitsForStripeRole(stripeRole);
      const limit = feature === "generation" ? limits.generation : limits.analysis;

      // -1 means unlimited
      if (limit === -1) {
        await next();
        return;
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const featureType =
        feature === "analysis" ? "reel_analysis" : "generation";

      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(featureUsages)
        .where(
          and(
            eq(featureUsages.userId, userId),
            eq(featureUsages.featureType, featureType),
            gte(featureUsages.createdAt, monthStart),
          ),
        );

      const used = row?.count ?? 0;

      if (used >= limit) {
        return c.json(
          {
            error: "Monthly usage limit reached",
            code: "USAGE_LIMIT_REACHED",
            feature,
            used,
            limit,
          },
          403,
        );
      }

      await next();
    } catch (error) {
      debugLog.error("Usage gate error", {
        service: "usage-gate",
        operation: "usageGate",
        feature,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Fail open — don't block the request on gate errors
      await next();
    }
  };
}

/**
 * Records a usage event in the featureUsages table.
 * Call this after a billable action succeeds.
 */
export async function recordUsage(
  userId: string,
  featureType: "generation" | "reel_analysis",
  inputData: Record<string, unknown> = {},
  resultData: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(featureUsages).values({
    userId,
    featureType,
    inputData,
    resultData,
    usageTimeMs: 0,
  });
}
