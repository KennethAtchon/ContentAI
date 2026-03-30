import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import { usageGate } from "../../middleware/usage-gate";
import type { HonoEnv } from "../../types/hono.types";
import { reelsService } from "../../domain/singletons";
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
    const auth = c.get("auth");
    const body = await reelsService.getUsageDashboard(auth.user.id);
    return c.json(body);
  },
);

reelsRouter.get(
  "/niches",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const body = await reelsService.listActiveNiches();
    return c.json(body);
  },
);

/** Registered before `/:id` so `GET /export` is not captured as a numeric id. */
reelsRouter.get(
  "/export",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", reelsExportQuerySchema, validationErrorHook),
  async (c) => {
    const result = await reelsService.buildExportPayload(c.req.valid("query"));
    if (result.kind === "error") {
      const code = result.status === 400 ? "BAD_REQUEST" : "NOT_FOUND";
      return c.json(
        { error: result.message, code },
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
  },
);

reelsRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", reelsListQuerySchema, validationErrorHook),
  async (c) => {
    const body = await reelsService.listReels(c.req.valid("query"));
    return c.json(body);
  },
);

reelsRouter.post(
  "/bulk",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("json", bulkReelsSchema, validationErrorHook),
  async (c) => {
    const body = await reelsService.bulkByIds(c.req.valid("json"));
    return c.json(body);
  },
);

reelsRouter.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = await reelsService.getReelWithAnalysis(id);
    return c.json(body);
  },
);

reelsRouter.get(
  "/:id/media-url",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = await reelsService.getPlayableMediaUrl(id);
    return c.json(body);
  },
);

reelsRouter.post(
  "/:id/analyze",
  rateLimiter("customer"),
  authMiddleware("user"),
  usageGate("analysis"),
  zValidator("param", reelIdParamSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const body = await reelsService.analyzeReelForUser(id, auth.user.id);
    return c.json(body);
  },
);

export default reelsRouter;
