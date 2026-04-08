import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { audioService, syncService } from "../../domain/singletons";
import { AppError } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";
import {
  audioListQuerySchema,
  audioTtsBodySchema,
} from "../../domain/audio/audio.schemas";

const audioRouter = new Hono<HonoEnv>();

audioRouter.get(
  "/trending",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", audioListQuerySchema, zodValidationErrorHook),
  async (c) => {
    const q = c.req.valid("query");
    const body = await audioService.listTrendingAudio(q);
    return c.json(body);
  },
);

audioRouter.get(
  "/voices",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const body = audioService.listVoicesWithPreviewUrls();
    return c.json(body);
  },
);

audioRouter.post(
  "/tts",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", audioTtsBodySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { generatedContentId, text, voiceId, speed } = c.req.valid("json");

    try {
      const json = await audioService.generateVoiceover({
        userId: auth.user.id,
        generatedContentId,
        text,
        voiceId,
        speed,
      });
      await syncService
        .syncLinkedProjects(auth.user.id, generatedContentId)
        .catch((err) =>
          debugLog.warn("syncLinkedProjects (voiceover) failed", {
            err,
            contentId: generatedContentId,
          }),
        );

      return c.json(json);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (
        error instanceof Error &&
        error.message.startsWith("TTS_PROVIDER_ERROR")
      ) {
        throw new AppError(
          "Voice generation failed. Please try again.",
          "TTS_PROVIDER_ERROR",
          502,
        );
      }
      throw error;
    }
  },
);

export default audioRouter;
