import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { musicService } from "../../domain/singletons";
import { AppError } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";
import {
  musicAttachBodySchema,
  musicListQuerySchema,
} from "../../domain/music/music.schemas";

const app = new Hono<HonoEnv>();
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

app.get(
  "/library",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", musicListQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const q = c.req.valid("query");
      const body = await musicService.listLibrary(q);
      return c.json(body);
    } catch (error) {
      debugLog.error("Failed to fetch music library", {
        service: "music-route",
        operation: "getLibrary",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch music library" }, 500);
    }
  },
);

app.post(
  "/attach",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", musicAttachBodySchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { generatedContentId, musicTrackId } = c.req.valid("json");

      const json = await musicService.attachMusicToContent(
        auth.user.id,
        generatedContentId,
        musicTrackId,
      );

      const { refreshEditorTimeline } = await import(
        "../editor/services/refresh-editor-timeline"
      );
      await refreshEditorTimeline(generatedContentId, auth.user.id).catch(
        (err) =>
          debugLog.warn("refreshEditorTimeline (attach-music) failed", {
            err,
            contentId: generatedContentId,
          }),
      );

      return c.json(json);
    } catch (error) {
      if (error instanceof AppError) throw error;
      debugLog.error("Failed to attach music", {
        service: "music-route",
        operation: "attachMusic",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to attach music" }, 500);
    }
  },
);

export default app;
