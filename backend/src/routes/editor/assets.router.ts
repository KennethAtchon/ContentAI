import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { contentService } from "../../domain/singletons";
import { editorAssetsQuerySchema } from "../../domain/editor/editor.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const assetsRouter = new Hono<HonoEnv>();

/** GET / — mounted at /api/editor/assets */
assetsRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", editorAssetsQuerySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { contentId } = c.req.valid("query");
    const roles = c.req.queries("role") ?? [];

    const options: {
      contentId?: number;
      roles?: string[];
      excludeRoles?: string[];
    } = {};

    if (contentId) {
      options.contentId = contentId;
    }

    if (roles.length > 0) {
      options.roles = roles;
    } else {
      options.excludeRoles = ["assembled_video", "final_video"];
    }

    const result = await contentService.listEditorAssetsForUser(
      auth.user.id,
      options,
    );

    return c.json({ assets: result });
  },
);

export default assetsRouter;
