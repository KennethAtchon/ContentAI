import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import {
  editorRepository,
  contentService,
  captionsService,
} from "../../domain/singletons";
import { buildCaptionClip } from "../../domain/editor/timeline/build-caption-clip";
import type { CaptionClip } from "../../types/timeline.types";
import { debugLog } from "../../utils/debug/debug";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "../../utils/config/envUtil";
import { buildAIAssemblyPrompt } from "./services/ai-assembly-prompt";
import { aiAssemblyResponseSchema, aiAssembleRequestSchema } from "./schemas";
import { editorProjectIdParamSchema } from "../../domain/editor/editor.schemas";
import { AppError, Errors } from "../../utils/errors/app-error";
import {
  loadProjectShotAssets,
  convertAIResponseToTracks,
  buildStandardPresetTracks,
} from "../../domain/editor/timeline/ai-assembly-tracks";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY ?? "" });

const assemblyRouter = new Hono<HonoEnv>();

assemblyRouter.post(
  "/:id/ai-assemble",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  zValidator("json", aiAssembleRequestSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const { platform } = c.req.valid("json");

    const project = await editorRepository.findByIdAndUserId(id, auth.user.id);
    if (!project) throw Errors.notFound("Edit project");
    if (!project.generatedContentId) {
      throw new AppError(
        "Project has no generated content — AI assembly requires generated shots",
        "CONTENT_REQUIRED",
        404,
      );
    }

    const shotAssets = await loadProjectShotAssets(
      auth.user.id,
      project.generatedContentId,
    );

    if (shotAssets.length === 0) {
      throw new AppError("No shot clips available", "NO_SHOT_CLIPS", 400);
    }

    // Fetch aux assets via content service
    const allAssets = await contentService.listAssetsForContent(
      project.generatedContentId,
    );
    const auxRows = allAssets
      .filter((a) => a.role !== "shot_clip")
      .map((a) => ({
        role: a.role,
        id: a.id,
        durationMs: a.durationMs,
      }));
    const voiceR = auxRows.find((r) => r.role === "voiceover");
    const musicR = auxRows.find((r) => r.role === "background_music");
    const shotSpan = shotAssets.reduce((s, a) => s + (a.durationMs ?? 5000), 0);
    const auxPack = {
      voiceover: voiceR
        ? { id: voiceR.id, durationMs: voiceR.durationMs }
        : undefined,
      music: musicR
        ? { id: musicR.id, durationMs: musicR.durationMs }
        : undefined,
      totalVideoMs: shotSpan,
    };

    const voiceoverAsset = auxPack.voiceover ?? null;
    let captionClip: CaptionClip | null = null;
    if (voiceoverAsset && (voiceoverAsset.durationMs ?? 0) > 0) {
      try {
        const { captionDocId } = await captionsService.transcribeAsset(
          auth.user.id,
          voiceoverAsset.id,
        );
        captionClip = buildCaptionClip({
          captionDocId,
          voiceoverAsset,
          voiceoverClipId: null,
        });
      } catch (err) {
        debugLog.warn(
          "Caption transcription failed during ai-assemble; continuing without captions",
          {
            service: "editor-route",
            operation: "aiAssemble",
            projectId: id,
            error: err instanceof Error ? err.message : "Unknown error",
          },
        );
      }
    }

    const shotsContext = shotAssets.map((asset, i) => ({
      index: i,
      description:
        ((asset.metadata as Record<string, unknown>)
          ?.generationPrompt as string) ?? `Shot ${i + 1}`,
      durationMs: asset.durationMs ?? 5000,
    }));

    const targetDurationMs =
      platform === "tiktok"
        ? 15000
        : platform === "youtube-shorts"
          ? 60000
          : 30000;

    const prompt = buildAIAssemblyPrompt({
      shots: shotsContext,
      platform,
      targetDurationMs,
    });

    let aiResponse: z.infer<typeof aiAssemblyResponseSchema> | null = null;
    try {
      const result = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        prompt,
        maxOutputTokens: 1024,
      });

      const text = result.text;
      const jsonMatch = text.match(/```json\n?([\s\S]+?)\n?```/);
      const raw = JSON.parse(jsonMatch ? jsonMatch[1] : text);
      aiResponse = aiAssemblyResponseSchema.parse(raw);

      const maxIndex = shotsContext.length - 1;
      for (const cut of aiResponse.cuts) {
        if (cut.shotIndex > maxIndex) {
          throw new Error(
            `Shot index ${cut.shotIndex} out of range (max ${maxIndex})`,
          );
        }
        const shotDuration = shotsContext[cut.shotIndex].durationMs;
        if (cut.trimEndMs > shotDuration) {
          throw new Error(
            `trimEndMs ${cut.trimEndMs} exceeds shot ${cut.shotIndex} duration ${shotDuration}`,
          );
        }
      }
    } catch (err) {
      debugLog.error(
        "AI assembly parse failed — returning Standard preset fallback",
        {
          service: "editor-route",
          operation: "aiAssemble",
          projectId: id,
          error: err instanceof Error ? err.message : "Unknown error",
        },
      );

      const standardTimeline = buildStandardPresetTracks(
        shotAssets,
        {
          voiceover: auxPack.voiceover,
          music: auxPack.music,
          musicVolume: 0.22,
        },
        captionClip,
      );
      return c.json({
        timeline: standardTimeline,
        assembledBy: "ai" as const,
        fallback: true,
      });
    }

    const timeline = convertAIResponseToTracks(
      aiResponse,
      shotAssets,
      auxPack,
      captionClip,
    );

    return c.json({
      timeline,
      assembledBy: "ai" as const,
      fallback: false,
    });
  },
);

export default assemblyRouter;
