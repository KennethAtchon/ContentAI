import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { captionsService } from "../../domain/singletons";
import {
  captionAssetIdParamSchema,
  transcribeCaptionsSchema,
} from "../../domain/editor/editor.schemas";
import { editorZodValidationHook } from "./zod-validation-hook";

const app = new Hono<HonoEnv>();

app.post(
  "/transcribe",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", transcribeCaptionsSchema, editorZodValidationHook),
  async (c) => {
    const auth = c.get("auth");
    const { assetId } = c.req.valid("json");
    const body = await captionsService.transcribeAsset(auth.user.id, assetId);
    return c.json(body);
  },
);

app.get(
  "/:assetId",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", captionAssetIdParamSchema, editorZodValidationHook),
  async (c) => {
    const auth = c.get("auth");
    const { assetId } = c.req.valid("param");
    const body = await captionsService.getCaptionsForAsset(
      auth.user.id,
      assetId,
    );
    return c.json(body);
  },
);

export default app;
