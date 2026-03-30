import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { getObjectWebStream } from "../../services/storage/r2";
import { Errors } from "../../utils/errors/app-error";
import { assetsService } from "../../domain/singletons";
import { assetIdParamSchema } from "../../domain/assets/assets.schemas";
import { assetsValidationErrorHook } from "./shared-validation";

const mediaRouter = new Hono<HonoEnv>();

mediaRouter.get(
  "/:id/media-for-decode",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", assetIdParamSchema, assetsValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    const row = await assetsService.getR2KeyForAsset(auth.user.id, id);

    if (!row?.r2Key) {
      throw Errors.notFound("Asset");
    }

    const { stream, contentType } = await getObjectWebStream(row.r2Key);
    return c.body(stream, 200, {
      "Content-Type":
        contentType ?? row.mimeType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=120",
    });
  },
);

export default mediaRouter;
