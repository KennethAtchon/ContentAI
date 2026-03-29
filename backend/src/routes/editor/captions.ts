import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import { assets, captions } from "../../infrastructure/database/drizzle/schema";
import type { CaptionWord } from "../../infrastructure/database/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl } from "../../services/storage/r2";
import { OPENAI_API_KEY } from "../../utils/config/envUtil";
import OpenAI from "openai";
import {
  captionAssetIdParamSchema,
  transcribeCaptionsSchema,
} from "../../domain/editor/editor.schemas";

const app = new Hono<HonoEnv>();

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (Whisper limit)

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

// ─── POST /api/captions/transcribe ──────────────────────────────────────────

app.post(
  "/transcribe",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", transcribeCaptionsSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { assetId } = c.req.valid("json");

      // 1. Fetch asset, verify ownership
      const [asset] = await db
        .select()
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.userId, auth.user.id)))
        .limit(1);

      if (!asset) {
        return c.json({ error: "Asset not found" }, 404);
      }

      if (!["voiceover", "audio"].includes(asset.type)) {
        return c.json(
          {
            error: `Asset type "${asset.type}" is not supported. Must be "voiceover" or "audio".`,
          },
          400,
        );
      }

      if (!asset.r2Key) {
        return c.json({ error: "Asset has no associated file" }, 400);
      }

      // 2. Check for existing captions (idempotent -- do not re-charge)
      const [existing] = await db
        .select()
        .from(captions)
        .where(
          and(eq(captions.assetId, assetId), eq(captions.userId, auth.user.id)),
        )
        .limit(1);

      if (existing) {
        return c.json({
          captionId: existing.id,
          words: existing.words,
          fullText: existing.fullText,
        });
      }

      // 3. Download audio from R2
      let audioBuffer: Buffer;
      try {
        const signedUrl = await getFileUrl(asset.r2Key, 3600);
        const res = await fetch(signedUrl);
        if (!res.ok) {
          throw new Error(`R2 download failed: HTTP ${res.status}`);
        }
        audioBuffer = Buffer.from(await res.arrayBuffer());
      } catch (err) {
        debugLog.error("Failed to download audio from R2", {
          service: "captions-route",
          operation: "downloadAudio",
          assetId,
          r2Key: asset.r2Key,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        return c.json({ error: "Failed to download audio file" }, 500);
      }

      // 4. Check file size
      if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
        return c.json(
          {
            error: `Audio file is ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB. Maximum is 25 MB.`,
          },
          413,
        );
      }

      // 5. Send to Whisper
      let transcription: OpenAI.Audio.Transcription & {
        words?: Array<{ word: string; start: number; end: number }>;
      };
      try {
        const mimeType = asset.mimeType ?? "audio/mpeg";
        const ext = mimeType.includes("wav")
          ? "wav"
          : mimeType.includes("mp4") || mimeType.includes("m4a")
            ? "m4a"
            : "mp3";

        transcription = (await openai.audio.transcriptions.create({
          file: new File([new Uint8Array(audioBuffer)], `audio.${ext}`, {
            type: mimeType,
          }),
          model: "whisper-1",
          response_format: "verbose_json",
          timestamp_granularities: ["word"],
        })) as any;
      } catch (err) {
        debugLog.error("Whisper API call failed", {
          service: "captions-route",
          operation: "whisperTranscribe",
          assetId,
          error: err instanceof Error ? err.message : "Unknown error",
        });

        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("too short") || message.includes("too long")) {
          return c.json(
            { error: `Whisper rejected the audio: ${message}` },
            422,
          );
        }
        if (message.includes("format")) {
          return c.json(
            {
              error: `Unsupported audio format. Whisper supports mp3, mp4, m4a, wav, and webm.`,
            },
            422,
          );
        }
        return c.json({ error: "Transcription failed" }, 502);
      }

      // 6. Convert seconds to ms
      const whisperWords = transcription.words ?? [];
      const words: CaptionWord[] = whisperWords.map(
        (w: { word: string; start: number; end: number }) => ({
          word: w.word,
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        }),
      );

      // 7. Save to DB
      const [saved] = await db
        .insert(captions)
        .values({
          userId: auth.user.id,
          assetId,
          language: "en",
          words,
          fullText: transcription.text ?? "",
        })
        .returning();

      debugLog.info("Caption transcription completed", {
        service: "captions-route",
        operation: "transcribe",
        assetId,
        wordCount: words.length,
      });

      return c.json({
        captionId: saved.id,
        words,
        fullText: saved.fullText,
      });
    } catch (error) {
      debugLog.error("Failed to transcribe captions", {
        service: "captions-route",
        operation: "transcribe",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to transcribe captions" }, 500);
    }
  },
);

// ─── GET /api/captions/:assetId ─────────────────────────────────────────────

app.get(
  "/:assetId",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", captionAssetIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { assetId } = c.req.valid("param");

      const [caption] = await db
        .select()
        .from(captions)
        .where(
          and(eq(captions.assetId, assetId), eq(captions.userId, auth.user.id)),
        )
        .limit(1);

      if (!caption) {
        return c.json({ error: "No captions found for this asset" }, 404);
      }

      return c.json({
        captionId: caption.id,
        words: caption.words,
        fullText: caption.fullText,
      });
    } catch (error) {
      debugLog.error("Failed to fetch captions", {
        service: "captions-route",
        operation: "getCaptions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch captions" }, 500);
    }
  },
);

export default app;
