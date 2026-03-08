import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { CalculatorService } from "../../features/calculator/services/calculator-service";
import { VALID_CALCULATION_TYPES } from "../../features/calculator/types/calculator.types";
import {
  mortgageInputSchema,
  loanInputSchema,
  investmentInputSchema,
  retirementInputSchema,
  validateCalculatorInput,
} from "../../features/calculator/types/calculator-validation";
import {
  hasFeatureAccess,
  FEATURE_TIER_REQUIREMENTS,
} from "../../utils/permissions/core-feature-permissions";
import type { FeatureType } from "../../utils/permissions/core-feature-permissions";
import {
  getTierConfig,
  toSubscriptionTier,
} from "../../constants/subscription.constants";
import { getMonthlyUsageCount } from "../../features/calculator/services/usage-service";
import { db } from "../../services/db/db";
import { featureUsages } from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";

const calculator = new Hono<HonoEnv>();

/**
 * POST /api/calculator/calculate
 */
calculator.post(
  "/calculate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json();
      const { type, inputs } = body;

      // Validate calculation type
      if (!type || !VALID_CALCULATION_TYPES.includes(type)) {
        return c.json({ error: "Invalid calculation type" }, 400);
      }

      const featureType = type as FeatureType;

      // Validate inputs based on type
      const schemaMap: Record<string, any> = {
        mortgage: mortgageInputSchema,
        loan: loanInputSchema,
        investment: investmentInputSchema,
        retirement: retirementInputSchema,
      };

      const schema = schemaMap[type];
      if (!schema)
        return c.json({ error: "Unsupported calculation type" }, 400);

      const validation = validateCalculatorInput(schema, inputs);
      if (!validation.success) {
        return c.json(
          { error: `Invalid ${type} inputs`, details: validation.details },
          400,
        );
      }

      // Check access permissions
      const stripeRole = toSubscriptionTier(auth.firebaseUser.stripeRole);
      if (!hasFeatureAccess(stripeRole, featureType)) {
        const requiredTier = FEATURE_TIER_REQUIREMENTS[featureType];
        if (!stripeRole) {
          return c.json(
            { error: "Active subscription required to use this calculator" },
            403,
          );
        }
        return c.json(
          {
            error: `This calculation type requires ${requiredTier} tier or higher. Your current plan: ${stripeRole}.`,
          },
          403,
        );
      }

      // Check usage limits
      if (FEATURE_TIER_REQUIREMENTS[featureType] !== null && stripeRole) {
        const tierConfig = getTierConfig(stripeRole);
        const usageLimit =
          tierConfig.features.maxCalculationsPerMonth === -1
            ? null
            : tierConfig.features.maxCalculationsPerMonth;

        if (usageLimit !== null) {
          const usageCount = await getMonthlyUsageCount(auth.user.id);
          if (usageCount >= usageLimit) {
            return c.json(
              {
                error:
                  "Monthly calculation limit reached. Please upgrade your plan.",
              },
              403,
            );
          }
        }
      }

      // Perform calculation
      const result = CalculatorService.performCalculation(
        type,
        validation.data,
      );

      // Save calculation history
      try {
        const serializedResults = JSON.parse(JSON.stringify(result.results));
        await db.insert(featureUsages).values({
          userId: auth.user.id,
          featureType: type,
          inputData: result.inputs,
          resultData: serializedResults,
          usageTimeMs: result.calculationTime,
        });
      } catch {
        // Don't fail if history save fails
      }

      return c.json(result);
    } catch (error) {
      debugLog.error("Calculation error", {
        service: "calculator-route",
        operation: "calculate",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to perform calculation" }, 500);
    }
  },
);

/**
 * GET /api/calculator/history
 */
calculator.get(
  "/history",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = parseInt(c.req.query("limit") || "20", 10);
      const type = c.req.query("type");
      const skip = (page - 1) * limit;

      const historyWhere = and(
        eq(featureUsages.userId, auth.user.id),
        type ? eq(featureUsages.featureType, type) : undefined,
      );

      const [history, [{ total }]] = await Promise.all([
        db
          .select()
          .from(featureUsages)
          .where(historyWhere)
          .orderBy(desc(featureUsages.createdAt))
          .offset(skip)
          .limit(limit),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(featureUsages)
          .where(historyWhere),
      ]);

      return c.json({
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      debugLog.error("Failed to fetch history", {
        service: "calculator-route",
        operation: "getHistory",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch calculation history" }, 500);
    }
  },
);

/**
 * GET /api/calculator/usage
 */
calculator.get(
  "/usage",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const usageCount = await getMonthlyUsageCount(auth.user.id);
      const stripeRole = toSubscriptionTier(auth.firebaseUser.stripeRole);
      const tierConfig = stripeRole ? getTierConfig(stripeRole) : null;
      const limit = tierConfig?.features.maxCalculationsPerMonth ?? 0;

      return c.json({
        used: usageCount,
        limit: limit === -1 ? "unlimited" : limit,
        remaining: limit === -1 ? "unlimited" : Math.max(0, limit - usageCount),
      });
    } catch (error) {
      debugLog.error("Failed to fetch usage", {
        service: "calculator-route",
        operation: "getUsage",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch usage" }, 500);
    }
  },
);

/**
 * GET /api/calculator/types
 */
calculator.get(
  "/types",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const stripeRole = toSubscriptionTier(auth.firebaseUser.stripeRole);

      const types = VALID_CALCULATION_TYPES.map((type) => ({
        type,
        hasAccess: hasFeatureAccess(stripeRole, type as FeatureType),
        requiredTier: FEATURE_TIER_REQUIREMENTS[type as FeatureType],
      }));

      return c.json({ types });
    } catch (error) {
      debugLog.error("Failed to fetch types", {
        service: "calculator-route",
        operation: "getTypes",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch calculator types" }, 500);
    }
  },
);

/**
 * GET /api/calculator/export
 */
calculator.get(
  "/export",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const format = c.req.query("format") || "json";

      const history = await db
        .select()
        .from(featureUsages)
        .where(eq(featureUsages.userId, auth.user.id))
        .orderBy(desc(featureUsages.createdAt));

      if (format === "csv") {
        const csvRows = [
          "Date,Type,Inputs,Results,Time(ms)",
          ...history.map(
            (h: any) =>
              `${h.createdAt.toISOString()},${h.featureType},"${JSON.stringify(h.inputData)}","${JSON.stringify(h.resultData)}",${h.usageTimeMs}`,
          ),
        ];
        return new Response(csvRows.join("\n"), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="calculations.csv"',
          },
        });
      }

      return c.json({ history });
    } catch (error) {
      debugLog.error("Failed to export", {
        service: "calculator-route",
        operation: "export",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to export calculations" }, 500);
    }
  },
);

export default calculator;
