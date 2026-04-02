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
  captionDocIdParamSchema,
  manualCaptionDocSchema,
  patchCaptionDocSchema,
  transcribeCaptionsSchema,
} from "../../domain/editor/editor.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const app = new Hono<HonoEnv>();

app.post(
  "/transcribe",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", transcribeCaptionsSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { assetId, force } = c.req.valid("json");
    const body = await captionsService.transcribeAsset(auth.user.id, assetId, {
      force,
    });
    return c.json(body);
  },
);

app.post(
  "/manual",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", manualCaptionDocSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const body = await captionsService.createManual(
      auth.user.id,
      c.req.valid("json"),
    );
    return c.json(body, 201);
  },
);

app.get(
  "/presets",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const body = await captionsService.listPresets();
    return c.json(body);
  },
);

app.get(
  "/doc/:captionDocId",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", captionDocIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { captionDocId } = c.req.valid("param");
    const body = await captionsService.getCaptionDoc(auth.user.id, captionDocId);
    return c.json(body);
  },
);

app.patch(
  "/doc/:captionDocId",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", captionDocIdParamSchema, zodValidationErrorHook),
  zValidator("json", patchCaptionDocSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { captionDocId } = c.req.valid("param");
    const body = await captionsService.updateCaptionDoc(
      auth.user.id,
      captionDocId,
      c.req.valid("json"),
    );
    return c.json(body);
  },
);

app.get(
  "/:assetId",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", captionAssetIdParamSchema, zodValidationErrorHook),
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
