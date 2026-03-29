import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import { usageGate } from "../../middleware/usage-gate";
import type { HonoEnv } from "../../types/hono.types";
import { reelsService } from "../../domain/singletons";
import { AppError } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";
import {
  bulkReelsSchema,
  reelIdParamSchema,
  reelsExportQuerySchema,
  reelsListQuerySchema,
} from "../../domain/reels/reels.schemas";

const reelsRouter = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

reelsRouter.get(
  "/usage",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await reelsService.getUsageDashboard(auth.user.id);
      return c.json(body);
    } catch (error) {
      debugLog.error("Failed to fetch usage stats", {
        service: "reels-route",
        operation: "getUsage",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch usage stats" }, 500);
    }
  },
);

reelsRouter.get(
  "/niches",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const body = await reelsService.listActiveNiches();
      return c.json(body);
    } catch (error) {
      debugLog.error("Failed to fetch niches", {
        service: "reels-route",
        operation: "listNiches",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch niches" }, 500);
    }
  },
);

/** Registered before `/:id` so `GET /export` is not captured as a numeric id. */
reelsRouter.get(
  "/export",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", reelsExportQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const result = await reelsService.buildExportPayload(c.req.valid("query"));
      if (result.kind === "error") {
        return c.json(
          { error: result.message },
          result.status as ContentfulStatusCode,
        );
      }
      if (result.kind === "csv") {
        return new Response(result.csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="reels_export_${result.nicheId}.csv"`,
          },
        });
      }
      return c.json(result.body);
    } catch (error) {
      debugLog.error("Failed to export reels", {
        service: "reels-route",
        operation: "exportReels",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to export reels" }, 500);
    }
  },
);

reelsRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", reelsListQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const body = await reelsService.listReels(c.req.valid("query"));
      return c.json(body);
    } catch (error) {
      debugLog.error("Failed to fetch reels", {
        service: "reels-route",
        operation: "listReels",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch reels" }, 500);
    }
  },
);

reelsRouter.post(
  "/bulk",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("json", bulkReelsSchema, validationErrorHook),
  async (c) => {
    try {
      const body = await reelsService.bulkByIds(c.req.valid("json"));
      return c.json(body);
    } catch (error) {
      debugLog.error("Failed to fetch reels in bulk", {
        service: "reels-route",
        operation: "bulkReels",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch reels" }, 500);
    }
  },
);

reelsRouter.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const body = await reelsService.getReelWithAnalysis(id);
      return c.json(body);
    } catch (error) {
      if (error instanceof AppError) throw error;
      debugLog.error("Failed to fetch reel", {
        service: "reels-route",
        operation: "getReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch reel" }, 500);
    }
  },
);

reelsRouter.get(
  "/:id/media-url",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const body = await reelsService.getPlayableMediaUrl(id);
      return c.json(body);
    } catch (error) {
      if (error instanceof AppError) throw error;
      debugLog.error("Failed to get media URL", {
        service: "reels-route",
        operation: "getMediaUrl",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to get media URL" }, 500);
    }
  },
);

reelsRouter.post(
  "/:id/analyze",
  rateLimiter("customer"),
  authMiddleware("user"),
  usageGate("analysis"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");
      const body = await reelsService.analyzeReelForUser(id, auth.user.id);
      return c.json(body);
    } catch (error) {
      debugLog.error("Failed to analyze reel", {
        service: "reels-route",
        operation: "analyzeReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to analyze reel" }, 500);
    }
  },
);

export default reelsRouter;
