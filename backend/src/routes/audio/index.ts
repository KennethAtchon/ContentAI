import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { audioService } from "../../domain/singletons";
import { AppError } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";
import {
  audioListQuerySchema,
  audioTtsBodySchema,
} from "../../domain/audio/audio.schemas";

const audioRouter = new Hono<HonoEnv>();
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

audioRouter.get(
  "/trending",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", audioListQuerySchema, validationErrorHook),
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
  zValidator("json", audioTtsBodySchema, validationErrorHook),
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

      const { refreshEditorTimeline } = await import(
        "../editor/services/refresh-editor-timeline"
      );
      await refreshEditorTimeline(generatedContentId, auth.user.id).catch(
        (err) =>
          debugLog.warn("refreshEditorTimeline (voiceover) failed", {
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
