import { Hono } from "hono";
import {
  authMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import {
  assets,
  contentAssets,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, inArray, notInArray } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";

const assetsRouter = new Hono<HonoEnv>();

/** GET / — mounted at /api/editor/assets */
assetsRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const contentIdParam = c.req.query("contentId");
      const roles = c.req.queries("role") ?? [];

      const userContentIds = db
        .select({ id: generatedContent.id })
        .from(generatedContent)
        .where(eq(generatedContent.userId, auth.user.id));

      const conditions: ReturnType<typeof eq>[] = [
        inArray(contentAssets.generatedContentId, userContentIds) as ReturnType<
          typeof eq
        >,
      ];

      if (contentIdParam) {
        conditions.push(
          eq(contentAssets.generatedContentId, Number(contentIdParam)),
        );
      }
      if (roles.length > 0) {
        conditions.push(
          inArray(contentAssets.role, roles) as ReturnType<typeof eq>,
        );
      } else {
        conditions.push(
          notInArray(contentAssets.role, [
            "assembled_video",
            "final_video",
          ]) as ReturnType<typeof eq>,
        );
      }

      const result = await db
        .select({
          id: contentAssets.id,
          generatedContentId: contentAssets.generatedContentId,
          role: contentAssets.role,
          r2Url: assets.r2Url,
          durationMs: assets.durationMs,
          sourceHook: generatedContent.generatedHook,
        })
        .from(contentAssets)
        .innerJoin(assets, eq(contentAssets.assetId, assets.id))
        .innerJoin(
          generatedContent,
          eq(contentAssets.generatedContentId, generatedContent.id),
        )
        .where(and(...conditions))
        .orderBy(desc(assets.createdAt))
        .limit(100);

      return c.json({ assets: result });
    } catch (error) {
      debugLog.error("Failed to list editor assets", {
        service: "editor-route",
        operation: "listAssets",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to list editor assets" }, 500);
    }
  },
);

export default assetsRouter;
