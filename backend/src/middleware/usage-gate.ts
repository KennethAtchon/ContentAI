import type { MiddlewareHandler } from "hono";
import type { HonoEnv } from "../types/hono.types";
import { getFeatureLimitsForStripeRoleAsync } from "../constants/subscription.constants";
import { systemLogger } from "../utils/system/system-logger";
import { customerRepository } from "../domain/singletons";
import { Errors } from "../utils/errors/app-error";

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

      const limits = await getFeatureLimitsForStripeRoleAsync(stripeRole);
      const limit =
        feature === "generation" ? limits.generation : limits.analysis;

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

      const used = await customerRepository.getFeatureUsageCount(
        userId,
        featureType,
        monthStart,
      );

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
      systemLogger.error("Usage gate error", {
        service: "usage-gate",
        operation: "usageGate",
        feature,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw Errors.serviceUnavailable("Unable to verify current usage limit");
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
  await customerRepository.insertFeatureUsage({
    userId,
    featureType,
    inputData,
    resultData,
  });
}
