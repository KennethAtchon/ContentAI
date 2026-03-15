import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  reels,
  trendingAudio,
  generatedContent,
  reelAssets,
} from "../../infrastructure/database/drizzle/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getFileUrl, uploadFile, deleteFile } from "../../services/storage/r2";
import { R2_PUBLIC_URL } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";
import { VOICES, getVoiceById } from "../../config/voices";
import { generateSpeech, type TTSSpeed } from "../../services/tts/elevenlabs";
import { recordAiCost } from "../../lib/cost-tracker";

const audioRouter = new Hono<HonoEnv>();

const ttsRequestSchema = z.object({
  generatedContentId: z.number().int().positive(),
  text: z.string().min(1).max(5000),
  voiceId: z.string(),
  speed: z.enum(["slow", "normal", "fast"]),
});

/**
 * GET /api/audio/trending
 * Returns trending audio usage within a time window.
 */
audioRouter.get(
  "/trending",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const days = Math.min(parseInt(c.req.query("days") ?? "7", 10), 90);
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
      const nicheIdParam = c.req.query("nicheId");
      const nicheId = nicheIdParam ? parseInt(nicheIdParam, 10) : null;

      const startWindow = sql.raw(`NOW() - INTERVAL '${days} days'`);
      const prevWindow = sql.raw(`NOW() - INTERVAL '${days * 2} days'`);

      const conditions = [
        sql`${reels.audioId} is not null`,
        sql`${reels.audioName} is not null`,
        gte(reels.scrapedAt, prevWindow),
      ];

      if (nicheId && !Number.isNaN(nicheId)) {
        conditions.push(eq(reels.nicheId, nicheId));
      }

      const rows = await db
        .select({
          audioId: reels.audioId,
          audioName: reels.audioName,
          artistName: trendingAudio.artistName,
          useCount: sql<number>`sum(case when ${reels.scrapedAt} >= ${startWindow} then 1 else 0 end)::int`,
          prevCount: sql<number>`sum(case when ${reels.scrapedAt} < ${startWindow} then 1 else 0 end)::int`,
          lastSeen: sql<string>`max(${reels.scrapedAt})::text`,
        })
        .from(reels)
        .leftJoin(trendingAudio, eq(trendingAudio.audioId, reels.audioId))
        .where(and(...conditions))
        .groupBy(reels.audioId, reels.audioName, trendingAudio.artistName)
        .orderBy(
          desc(
            sql`sum(case when ${reels.scrapedAt} >= ${startWindow} then 1 else 0 end)`,
          ),
        )
        .limit(limit);

      const audio = rows.map((row) => {
        const current = row.useCount ?? 0;
        const previous = row.prevCount ?? 0;
        const trend =
          current > previous
            ? "rising"
            : current < previous
              ? "declining"
              : "stable";

        return {
          audioId: row.audioId,
          audioName: row.audioName,
          artistName: row.artistName,
          useCount: current,
          lastSeen: row.lastSeen,
          trend,
        };
      });

      return c.json({ audio });
    } catch (error) {
      debugLog.error("Failed to fetch trending audio", {
        service: "audio-route",
        operation: "getTrending",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch trending audio" }, 500);
    }
  },
);

// GET /api/audio/voices
audioRouter.get(
  "/voices",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const voicesWithUrls = VOICES.map((voice) => {
          let previewUrl = "";
          if (voice.previewR2Key && R2_PUBLIC_URL) {
            previewUrl = `${R2_PUBLIC_URL}/${voice.previewR2Key}`;
          }
          return {
            id: voice.id,
            name: voice.name,
            description: voice.description,
            gender: voice.gender,
            previewUrl,
            provider: "elevenlabs",
          };
        });
      return c.json({ voices: voicesWithUrls });
    } catch (error) {
      debugLog.error("Failed to fetch voices", {
        service: "audio-route",
        operation: "getVoices",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch voices" }, 500);
    }
  },
);

// POST /api/audio/tts
audioRouter.post(
  "/tts",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", ttsRequestSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { generatedContentId, text, voiceId, speed } = c.req.valid("json");

      // Validate generatedContentId belongs to user
      const [content] = await db
        .select({ id: generatedContent.id })
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, generatedContentId),
            eq(generatedContent.userId, auth.user.id),
          ),
        );

      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      // Validate voice
      const voice = getVoiceById(voiceId);
      if (!voice) {
        return c.json({ error: "Invalid voiceId", code: "INVALID_VOICE" }, 400);
      }

      // Check if a voiceover already exists — delete it (regeneration)
      const [existing] = await db
        .select()
        .from(reelAssets)
        .where(
          and(
            eq(reelAssets.generatedContentId, generatedContentId),
            eq(reelAssets.userId, auth.user.id),
            eq(reelAssets.type, "voiceover"),
          ),
        );

      if (existing) {
        if (existing.r2Key) {
          await deleteFile(existing.r2Key).catch(() => {});
        }
        await db.delete(reelAssets).where(eq(reelAssets.id, existing.id));
      }

      // Generate TTS
      const startMs = Date.now();
      const { audioBuffer, durationMs } = await generateSpeech(
        text,
        voice,
        speed as TTSSpeed,
      );
      const generationMs = Date.now() - startMs;

      // Upload to R2
      const assetId = crypto.randomUUID();
      const r2Key = `audio/voiceovers/${auth.user.id}/${assetId}.mp3`;
      await uploadFile(audioBuffer, r2Key, "audio/mpeg");

      // Create reel_asset row
      const [asset] = await db
        .insert(reelAssets)
        .values({
          id: assetId,
          generatedContentId,
          userId: auth.user.id,
          type: "voiceover",
          r2Key,
          r2Url: null,
          durationMs,
          metadata: {
            voiceId,
            voiceName: voice.name,
            speed,
            provider: "elevenlabs",
            characterCount: text.length,
            volumeBalance: 70,
          },
        })
        .returning();

      // Track cost (ElevenLabs ~$0.30/1000 chars for standard voices)
      const costUsd = (text.length / 1000) * 0.3;
      recordAiCost({
        userId: auth.user.id,
        provider: "openai", // use openai as placeholder since the field is a union type
        model: "eleven_multilingual_v2",
        featureType: "tts",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: generationMs,
        metadata: {
          characterCount: text.length,
          voiceId,
          durationMs,
          costUsd,
        },
      }).catch(() => {});

      // Generate signed URL for playback
      const audioUrl = await getFileUrl(r2Key, 3600);

      return c.json({ asset, audioUrl });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("TTS_PROVIDER_ERROR")
      ) {
        return c.json(
          {
            error: "TTS_PROVIDER_ERROR",
            message: "Voice generation failed. Please try again.",
          },
          502,
        );
      }
      debugLog.error("Failed to generate TTS", {
        service: "audio-route",
        operation: "generateTTS",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to generate voiceover" }, 500);
    }
  },
);

export default audioRouter;
