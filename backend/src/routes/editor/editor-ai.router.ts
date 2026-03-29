import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import {
  editProjects,
  assets,
  contentAssets,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { normalizeMediaClipTrimFields } from "./services/refresh-editor-timeline";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "../../utils/config/envUtil";
import { buildAIAssemblyPrompt } from "./services/ai-assembly-prompt";
import {
  aiAssemblyResponseSchema,
  aiAssembleRequestSchema,
} from "./schemas";

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY ?? "" });

const aiRouter = new Hono<HonoEnv>();

// ─── Helper functions for AI assembly ────────────────────────────────────────

async function loadProjectShotAssets(
  userId: string,
  generatedContentId: number,
) {
  const rows = await db
    .select({
      id: assets.id,
      durationMs: assets.durationMs,
      metadata: assets.metadata,
    })
    .from(contentAssets)
    .innerJoin(assets, eq(contentAssets.assetId, assets.id))
    .where(
      and(
        eq(contentAssets.generatedContentId, generatedContentId),
        eq(assets.userId, userId),
        eq(contentAssets.role, "video_clip"),
      ),
    );

  return rows.sort((a, b) => {
    const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    return ai - bi;
  });
}

function mapCaptionStyleToPresetId(
  style: z.infer<typeof aiAssemblyResponseSchema>["captionStyle"],
): string {
  return style ?? "hormozi";
}

function convertAIResponseToTracks(
  aiResponse: z.infer<typeof aiAssemblyResponseSchema>,
  shotAssets: Array<{
    id: string;
    durationMs: number | null;
    metadata: unknown;
  }>,
  aux: {
    voiceover?: { id: string; durationMs: number | null };
    music?: { id: string; durationMs: number | null };
    totalVideoMs: number;
  },
) {
  let cursor = 0;
  const videoClips = aiResponse.cuts.map((cut, i) => {
    const asset = shotAssets[cut.shotIndex];
    const shotDuration = Math.max(1, asset.durationMs ?? 5000);
    let t0 = Math.max(0, Math.floor(cut.trimStartMs));
    let t1 = Math.floor(cut.trimEndMs);
    if (t0 >= shotDuration) t0 = 0;
    t1 = Math.min(Math.max(t1, t0 + 1), shotDuration);
    if (t0 >= t1) t1 = Math.min(t0 + 1, shotDuration);
    const clipDuration = t1 - t0;
    const clip = normalizeMediaClipTrimFields(shotDuration, {
      id: `ai-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${cut.shotIndex + 1}`,
      startMs: cursor,
      trimStartMs: t0,
      durationMs: clipDuration,
      speed: 1,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
      volume: 1,
      muted: false,
    });
    cursor += clipDuration;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, aux.totalVideoMs, 1000);

  const voiceDur = Math.max(1, aux.voiceover?.durationMs ?? spanMs);
  const audioClips = aux.voiceover
    ? [
        normalizeMediaClipTrimFields(voiceDur, {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: 1,
          muted: false,
        }),
      ]
    : [];

  const musicDur = Math.max(1, aux.music?.durationMs ?? spanMs);
  const musicClips = aux.music
    ? [
        normalizeMediaClipTrimFields(musicDur, {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: aiResponse.musicVolume,
          muted: false,
        }),
      ]
    : [];

  const captionPresetId = aiResponse.captionStyle
    ? mapCaptionStyleToPresetId(aiResponse.captionStyle)
    : "hormozi";
  const captionGroupSize = aiResponse.captionGroupSize ?? 3;
  const textClips =
    totalVideoMs > 0
      ? [
          {
            id: `ai-caption-${crypto.randomUUID()}`,
            assetId: aux.voiceover?.id ?? null,
            label: "Captions",
            startMs: 0,
            durationMs: totalVideoMs,
            trimStartMs: 0,
            trimEndMs: 0,
            sourceMaxDurationMs: totalVideoMs,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 0,
            muted: true,
            captionPresetId,
            captionGroupSize,
            captionPositionY: 80,
            captionWords: [] as {
              word: string;
              startMs: number;
              endMs: number;
            }[],
          },
        ]
      : [];

  return [
    {
      id: "video",
      type: "video" as const,
      name: "Video",
      muted: false,
      locked: false,
      clips: videoClips,
      transitions: [],
    },
    {
      id: "audio",
      type: "audio" as const,
      name: "Audio",
      muted: false,
      locked: false,
      clips: audioClips,
      transitions: [],
    },
    {
      id: "music",
      type: "music" as const,
      name: "Music",
      muted: false,
      locked: false,
      clips: musicClips,
      transitions: [],
    },
    {
      id: "text",
      type: "text" as const,
      name: "Caption",
      muted: false,
      locked: false,
      clips: textClips,
      transitions: [],
    },
  ];
}

function buildStandardPresetTracks(
  shotAssets: Array<{
    id: string;
    durationMs: number | null;
    metadata: unknown;
  }>,
  aux?: {
    voiceover?: { id: string; durationMs: number | null };
    music?: { id: string; durationMs: number | null };
    musicVolume?: number;
    captionPresetId?: string;
    captionGroupSize?: number;
  },
) {
  let cursor = 0;
  const videoClips = shotAssets.map((asset, i) => {
    const durationMs = Math.max(1, asset.durationMs ?? 5000);
    const clip = normalizeMediaClipTrimFields(durationMs, {
      id: `std-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${i + 1}`,
      startMs: cursor,
      speed: 1,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
      volume: 1,
      muted: false,
    });
    cursor += durationMs;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, 1000);
  const musicVol = aux?.musicVolume ?? 0.22;

  const voiceDur = Math.max(1, aux?.voiceover?.durationMs ?? spanMs);
  const audioClips = aux?.voiceover
    ? [
        normalizeMediaClipTrimFields(voiceDur, {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: 1,
          muted: false,
        }),
      ]
    : [];

  const musicDur = Math.max(1, aux?.music?.durationMs ?? spanMs);
  const musicClips = aux?.music
    ? [
        normalizeMediaClipTrimFields(musicDur, {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: musicVol,
          muted: false,
        }),
      ]
    : [];

  const capPreset = aux?.captionPresetId ?? "hormozi";
  const capGroup = aux?.captionGroupSize ?? 3;
  const textClips =
    totalVideoMs > 0
      ? [
          {
            id: `std-caption-${crypto.randomUUID()}`,
            assetId: aux?.voiceover?.id ?? null,
            label: "Captions",
            startMs: 0,
            durationMs: totalVideoMs,
            trimStartMs: 0,
            trimEndMs: 0,
            sourceMaxDurationMs: totalVideoMs,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 0,
            muted: true,
            captionPresetId: capPreset,
            captionGroupSize: capGroup,
            captionPositionY: 80,
            captionWords: [] as {
              word: string;
              startMs: number;
              endMs: number;
            }[],
          },
        ]
      : [];

  return [
    {
      id: "video",
      type: "video" as const,
      name: "Video",
      muted: false,
      locked: false,
      clips: videoClips,
      transitions: [],
    },
    {
      id: "audio",
      type: "audio" as const,
      name: "Audio",
      muted: false,
      locked: false,
      clips: audioClips,
      transitions: [],
    },
    {
      id: "music",
      type: "music" as const,
      name: "Music",
      muted: false,
      locked: false,
      clips: musicClips,
      transitions: [],
    },
    {
      id: "text",
      type: "text" as const,
      name: "Caption",
      muted: false,
      locked: false,
      clips: textClips,
      transitions: [],
    },
  ];
}

// ─── POST /api/editor/:id/ai-assemble ────────────────────────────────────────

aiRouter.post(
  "/:id/ai-assemble",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", aiAssembleRequestSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
      const { platform } = c.req.valid("json");

      const [project] = await db
        .select()
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!project) {
        return c.json({ error: "Edit project not found" }, 404);
      }
      if (!project.generatedContentId) {
        return c.json(
          {
            error:
              "Project has no generated content — AI assembly requires generated shots",
          },
          404,
        );
      }

      const shotAssets = await loadProjectShotAssets(
        auth.user.id,
        project.generatedContentId,
      );

      if (shotAssets.length === 0) {
        return c.json({ error: "No shot clips available" }, 400);
      }

      const auxRows = await db
        .select({
          role: contentAssets.role,
          id: assets.id,
          durationMs: assets.durationMs,
        })
        .from(contentAssets)
        .innerJoin(assets, eq(contentAssets.assetId, assets.id))
        .where(
          and(
            eq(contentAssets.generatedContentId, project.generatedContentId),
            eq(assets.userId, auth.user.id),
          ),
        );
      const voiceR = auxRows.find((r) => r.role === "voiceover");
      const musicR = auxRows.find((r) => r.role === "background_music");
      const shotSpan = shotAssets.reduce(
        (s, a) => s + (a.durationMs ?? 5000),
        0,
      );
      const auxPack = {
        voiceover: voiceR
          ? { id: voiceR.id, durationMs: voiceR.durationMs }
          : undefined,
        music: musicR
          ? { id: musicR.id, durationMs: musicR.durationMs }
          : undefined,
        totalVideoMs: shotSpan,
      };

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

        const standardTimeline = buildStandardPresetTracks(shotAssets, {
          voiceover: auxPack.voiceover,
          music: auxPack.music,
          musicVolume: 0.22,
          captionPresetId: "hormozi",
          captionGroupSize: 3,
        });
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
      );

      return c.json({
        timeline,
        assembledBy: "ai" as const,
        fallback: false,
      });
    } catch (error) {
      debugLog.error("AI assembly failed", {
        service: "editor-route",
        operation: "aiAssemble",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to run AI assembly" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/link-content ───────────────────────────────────────

aiRouter.post(
  "/:id/link-content",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const { id } = c.req.param();
      const auth = c.get("auth");

      const [project] = await db
        .select({
          id: editProjects.id,
          generatedContentId: editProjects.generatedContentId,
        })
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!project) return c.json({ error: "Not found" }, 404);

      // Already linked — idempotent return
      if (project.generatedContentId) {
        return c.json({ generatedContentId: project.generatedContentId });
      }

      // All three writes are in a transaction — partial failure leaves no orphaned rows.
      const linkedContentId = await db
        .transaction(async (tx) => {
          const [newContent] = await tx
            .insert(generatedContent)
            .values({
              userId: auth.user.id,
              prompt: null,
              status: "draft",
              version: 1,
              outputType: "full",
            })
            .returning({ id: generatedContent.id });

          // Link atomically — 0 rows updated means a concurrent request raced us
          const updated = await tx
            .update(editProjects)
            .set({ generatedContentId: newContent.id })
            .where(
              and(
                eq(editProjects.id, id),
                isNull(editProjects.generatedContentId),
              ),
            )
            .returning({ generatedContentId: editProjects.generatedContentId });

          if (!updated[0]) {
            throw new Error("RACE_LOST");
          }

          await tx.insert(queueItems).values({
            userId: auth.user.id,
            generatedContentId: newContent.id,
            status: "draft",
          });

          return newContent.id;
        })
        .catch(async (err: unknown) => {
          if (err instanceof Error && err.message === "RACE_LOST") {
            const [refetched] = await db
              .select({ generatedContentId: editProjects.generatedContentId })
              .from(editProjects)
              .where(eq(editProjects.id, id));
            return refetched?.generatedContentId ?? null;
          }
          throw err;
        });

      if (!linkedContentId) {
        return c.json({ error: "Failed to link content" }, 500);
      }

      return c.json({ generatedContentId: linkedContentId });
    } catch (error) {
      debugLog.error("Failed to link content", {
        service: "editor-route",
        operation: "linkContent",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to link content" }, 500);
    }
  },
);

export default aiRouter;
