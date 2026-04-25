import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { getFileUrl } from "../../services/storage/r2";
import { contentService } from "../../domain/singletons";
import { assetsListQuerySchema } from "../../domain/assets/assets.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const listRouter = new Hono<HonoEnv>();

listRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", assetsListQuerySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { generatedContentId, type: typeFilter } = c.req.valid("query");

    const rows = await contentService.listContentAssetsForUser(
      auth.user.id,
      generatedContentId,
      { typeFilter },
    );

    const assetsWithUrls = await Promise.all(
      rows.map(async (asset) => {
        if (asset.r2Key) {
          try {
            const signedUrl = await getFileUrl(asset.r2Key, 3600);
            const isAudio =
              asset.role === "voiceover" || asset.role === "background_music";
            return {
              ...asset,
              audioUrl: isAudio ? signedUrl : null,
              mediaUrl: signedUrl,
            };
          } catch {
            return { ...asset, audioUrl: null, mediaUrl: null };
          }
        }
        return { ...asset, audioUrl: null, mediaUrl: null };
      }),
    );

    return c.json({ assets: assetsWithUrls });
  },
);

export default listRouter;
