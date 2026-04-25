import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { deleteFile } from "../../services/storage/r2";
import { Errors } from "../../utils/errors/app-error";
import { assetsService } from "../../domain/singletons";
import {
  assetIdParamSchema,
  patchAssetSchema,
} from "../../domain/assets/assets.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const mutateRouter = new Hono<HonoEnv>();

mutateRouter.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", assetIdParamSchema, zodValidationErrorHook),
  zValidator("json", patchAssetSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const { metadata } = c.req.valid("json");

    const updated = await assetsService.updateMetadata(
      auth.user.id,
      id,
      metadata,
    );

    if (!updated) {
      throw Errors.notFound("Asset");
    }

    return c.json({ asset: updated });
  },
);

mutateRouter.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", assetIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    const existing = await assetsService.getUploadedAsset(auth.user.id, id);

    if (!existing) {
      throw Errors.notFound("Asset");
    }

    if (existing.type === "voiceover" && existing.r2Key) {
      await deleteFile(existing.r2Key).catch(() => {});
    }

    await assetsService.removeById(id);
    return c.body(null, 204);
  },
);

export default mutateRouter;
