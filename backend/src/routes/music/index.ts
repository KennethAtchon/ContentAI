import { systemLogger } from "@/utils/system/system-logger";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { musicService } from "../../domain/singletons";
import {
  musicAttachBodySchema,
  musicListQuerySchema,
} from "../../domain/music/music.schemas";

const app = new Hono<HonoEnv>();

app.get(
  "/library",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", musicListQuerySchema, zodValidationErrorHook),
  async (c) => {
    const q = c.req.valid("query");
    const body = await musicService.listLibrary(q);
    return c.json(body);
  },
);

app.post(
  "/attach",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", musicAttachBodySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { generatedContentId, musicTrackId } = c.req.valid("json");

    const json = await musicService.attachMusicToContent(
      auth.user.id,
      generatedContentId,
      musicTrackId,
    );

    const { refreshEditorTimeline } =
      await import("../editor/services/refresh-editor-timeline");
    await refreshEditorTimeline(generatedContentId, auth.user.id).catch((err) =>
      systemLogger.warn("refreshEditorTimeline (attach-music) failed", {
        err,
        contentId: generatedContentId,
      }),
    );

    return c.json(json);
  },
);

export default app;
