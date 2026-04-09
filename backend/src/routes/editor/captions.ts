import { Hono, type MiddlewareHandler } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { captionsService } from "../../domain/singletons";
import { checkRateLimit } from "../../services/rate-limit/rate-limit-redis";
import { IS_DEVELOPMENT } from "../../utils/config/envUtil";
import {
  captionAssetIdParamSchema,
  captionDocIdParamSchema,
  manualCaptionDocSchema,
  patchCaptionDocSchema,
  transcribeCaptionsSchema,
} from "../../domain/editor/editor.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const app = new Hono<HonoEnv>();

const transcriptionRateLimiter: MiddlewareHandler<HonoEnv> = async (
  c,
  next,
) => {
  if (IS_DEVELOPMENT) {
    await next();
    return;
  }

  const auth = c.get("auth");
  const userId = auth.user.id;
  const minuteAllowed = await checkRateLimit(userId, {
    maxRequests: 2,
    window: 60,
    keyPrefix: "caption_transcribe_minute",
  });
  const hourAllowed = await checkRateLimit(userId, {
    maxRequests: 20,
    window: 3600,
    keyPrefix: "caption_transcribe_hour",
  });

  if (!minuteAllowed || !hourAllowed) {
    const retryAfter = minuteAllowed ? 3600 : 60;
    c.res.headers.set("Retry-After", String(retryAfter));
    c.res.headers.set("X-Rate-Limit-Limit", minuteAllowed ? "20" : "2");
    c.res.headers.set("X-Rate-Limit-Remaining", "0");
    c.res.headers.set(
      "X-Rate-Limit-Reset",
      String(Date.now() + retryAfter * 1000),
    );
    return c.json(
      {
        error: "Too many transcription requests",
        code: "RATE_LIMIT_EXCEEDED",
      },
      429,
    );
  }

  await next();
};

app.post(
  "/transcribe",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  transcriptionRateLimiter,
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
    const body = await captionsService.getCaptionDoc(
      auth.user.id,
      captionDocId,
    );
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
