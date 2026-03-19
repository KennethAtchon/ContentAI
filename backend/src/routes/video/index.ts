import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray } from "drizzle-orm";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, rmSync, unlinkSync } from "fs";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  generatedContent,
  reelCompositions,
  reelAssets,
} from "../../infrastructure/database/drizzle/schema";
import { generateVideoClip } from "../../services/media/video-generation";
import type { VideoProvider } from "../../services/media/video-generation";
import { getFileUrl, uploadFile } from "../../services/storage/r2";
import { R2_PUBLIC_URL } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";
import {
  videoJobService,
  type VideoRenderJob,
  type VideoJobKind,
} from "../../services/video/job.service";
import getRedisConnection from "../../services/db/redis";
import {
  recordCompositionEvent,
  recordCompositionLatency,
} from "../../services/observability/metrics";
import {
  deriveUseClipAudioByIndex,
  extractCaptionSourceText,
  formatAssTime,
  parseScriptShots,
  type ShotInput,
} from "./utils";

const app = new Hono<HonoEnv>();

const providerSchema = z.enum(["kling-fal", "runway", "image-ken-burns"]);
const aspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

const createReelSchema = z.object({
  generatedContentId: z.number().int().positive(),
  prompt: z.string().min(1).max(1000).optional(),
  durationSeconds: z.number().int().min(3).max(10).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: providerSchema.optional(),
});

const regenerateShotSchema = z.object({
  generatedContentId: z.number().int().positive(),
  shotIndex: z.number().int().min(0),
  prompt: z.string().min(1).max(1000),
  durationSeconds: z.number().int().min(3).max(10).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: providerSchema.optional(),
});

const assembleSchema = z.object({
  generatedContentId: z.number().int().positive(),
  includeCaptions: z.boolean().optional(),
  audioMix: z
    .object({
      includeClipAudio: z.boolean().optional(),
      clipAudioVolume: z.number().min(0).max(1).optional(),
      voiceoverVolume: z.number().min(0).max(2).optional(),
      musicVolume: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const timelineItemSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1).optional(),
  lane: z.number().int().min(0).optional(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().min(1).optional(),
  role: z.string().optional(),
  transitionIn: z
    .object({
      type: z.enum(["cut", "crossfade", "swipe", "fade"]),
      durationMs: z.number().int().min(0).max(2000),
    })
    .optional(),
  transitionOut: z
    .object({
      type: z.enum(["cut", "crossfade", "swipe", "fade"]),
      durationMs: z.number().int().min(0).max(2000),
    })
    .optional(),
});

const timelineSchema = z.object({
  schemaVersion: z.number().int().default(1),
  fps: z.number().int().min(1).max(120).default(30),
  durationMs: z.number().int().min(1),
  tracks: z.object({
    video: z.array(timelineItemSchema).default([]),
    audio: z.array(timelineItemSchema).default([]),
    text: z.array(z.record(z.string(), z.unknown())).default([]),
    captions: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});

const compositionInitSchema = z.object({
  generatedContentId: z.number().int().positive(),
  mode: z.enum(["quick", "precision"]).default("quick"),
});

const compositionSaveSchema = z.object({
  expectedVersion: z.number().int().positive(),
  editMode: z.enum(["quick", "precision"]).default("quick"),
  timeline: timelineSchema,
});

const compositionValidateSchema = z.object({
  timeline: timelineSchema,
});

const compositionRenderSchema = z.object({
  expectedVersion: z.number().int().positive(),
  outputPreset: z.string().min(1).default("instagram-9-16"),
  includeCaptions: z.boolean().optional().default(true),
});

type AudioAssets = {
  voiceover: typeof reelAssets.$inferSelect | null;
  music: typeof reelAssets.$inferSelect | null;
};

type TimelineIssue = {
  code: string;
  track: string;
  itemIds: string[];
  severity: "error" | "warning";
  message: string;
};

type TimelinePayload = z.infer<typeof timelineSchema>;

const MAX_COMPOSITION_DURATION_MS = 180_000;
const MIN_RECOMMENDED_CLIP_MS = 800;
const MAX_RECOMMENDED_CLIP_MS = 12_000;

async function cleanupTempFiles(paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function getAssetTypeForTrack(track: "video" | "audio", role?: string): string[] {
  if (track === "video") return ["video_clip", "image"];
  if (role === "voiceover") return ["voiceover"];
  if (role === "music") return ["music"];
  return ["voiceover", "music"];
}

function hasTrackOverlap(items: Array<{ startMs: number; endMs: number }>): boolean {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].startMs < sorted[i - 1].endMs) return true;
  }
  return false;
}

function getItemSpanMs(item: {
  startMs: number;
  endMs: number;
  trimStartMs?: number;
  trimEndMs?: number;
}): number {
  const clipSpan = item.endMs - item.startMs;
  if (
    typeof item.trimStartMs === "number" &&
    typeof item.trimEndMs === "number" &&
    item.trimEndMs > item.trimStartMs
  ) {
    return item.trimEndMs - item.trimStartMs;
  }
  return clipSpan;
}

async function validateTimeline(input: {
  userId: string;
  generatedContentId: number;
  timeline: TimelinePayload;
}): Promise<TimelineIssue[]> {
  const issues: TimelineIssue[] = [];
  const videoItems = input.timeline.tracks.video ?? [];
  const audioItems = input.timeline.tracks.audio ?? [];

  for (const item of [...videoItems, ...audioItems]) {
    if (item.endMs <= item.startMs) {
      issues.push({
        code: "INVALID_TIME_RANGE",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "error",
        message: "Timeline item has invalid start/end range.",
      });
    }
    if (item.endMs > input.timeline.durationMs) {
      issues.push({
        code: "ITEM_EXCEEDS_DURATION",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "error",
        message: "Timeline item exceeds composition duration.",
      });
    }
  }

  if (input.timeline.durationMs > MAX_COMPOSITION_DURATION_MS) {
    issues.push({
      code: "COMPOSITION_DURATION_LIMIT_EXCEEDED",
      track: "timeline",
      itemIds: [],
      severity: "error",
      message: `Composition duration exceeds ${MAX_COMPOSITION_DURATION_MS}ms product limit.`,
    });
  }

  const laneGroups = new Map<number, typeof videoItems>();
  for (const item of videoItems) {
    const lane = item.lane ?? 0;
    const laneItems = laneGroups.get(lane) ?? [];
    laneItems.push(item);
    laneGroups.set(lane, laneItems);
  }
  for (const [lane, items] of laneGroups.entries()) {
    if (hasTrackOverlap(items)) {
      issues.push({
        code: "OVERLAPPING_VIDEO_SEGMENTS",
        track: "video",
        itemIds: items.map((it) => it.id),
        severity: "error",
        message: `Video segments overlap in lane ${lane}.`,
      });
    }

    const sorted = [...items].sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < sorted.length; i += 1) {
      const item = sorted[i];
      const spanMs = Math.max(1, getItemSpanMs(item));
      if (spanMs < MIN_RECOMMENDED_CLIP_MS || spanMs > MAX_RECOMMENDED_CLIP_MS) {
        issues.push({
          code: "CLIP_PACING_WARNING",
          track: "video",
          itemIds: [item.id],
          severity: "warning",
          message: `Clip ${item.id} duration is outside recommended pacing range (${MIN_RECOMMENDED_CLIP_MS}-${MAX_RECOMMENDED_CLIP_MS}ms).`,
        });
      }

      const nextItem = sorted[i + 1];
      const transitions = [
        { key: "transitionIn" as const, value: item.transitionIn },
        { key: "transitionOut" as const, value: item.transitionOut },
      ];
      for (const transition of transitions) {
        const t = transition.value;
        if (!t) continue;
        if (t.type === "cut" && t.durationMs !== 0) {
          issues.push({
            code: "TRANSITION_DURATION_INVALID",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: "Cut transitions must use 0ms duration.",
          });
          continue;
        }
        if (t.type !== "cut" && t.durationMs <= 0) {
          issues.push({
            code: "TRANSITION_DURATION_INVALID",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: `${t.type} transitions must use a positive duration.`,
          });
          continue;
        }
        if (t.durationMs > spanMs) {
          issues.push({
            code: "TRANSITION_EXCEEDS_CLIP_SPAN",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: "Transition duration cannot exceed source clip span.",
          });
        }
        if (transition.key === "transitionOut" && nextItem) {
          const nextSpan = Math.max(1, getItemSpanMs(nextItem));
          if (t.durationMs > nextSpan) {
            issues.push({
              code: "TRANSITION_EXCEEDS_NEXT_CLIP_SPAN",
              track: "video",
              itemIds: [item.id, nextItem.id],
              severity: "error",
              message: "Transition out duration exceeds next clip source span.",
            });
          }
        }
      }
    }
  }

  if (videoItems.length === 0) {
    issues.push({
      code: "MISSING_VIDEO_SEGMENTS",
      track: "video",
      itemIds: [],
      severity: "error",
      message: "At least one video segment is required.",
    });
  }

  const refs = [
    ...videoItems
      .filter((i) => i.assetId)
      .map((i) => ({ track: "video" as const, itemId: i.id, assetId: i.assetId!, role: i.role })),
    ...audioItems
      .filter((i) => i.assetId)
      .map((i) => ({ track: "audio" as const, itemId: i.id, assetId: i.assetId!, role: i.role })),
  ];

  if (refs.length > 0) {
    const assets = await db
      .select({
        id: reelAssets.id,
        type: reelAssets.type,
      })
      .from(reelAssets)
      .where(
        and(
          eq(reelAssets.userId, input.userId),
          eq(reelAssets.generatedContentId, input.generatedContentId),
          inArray(
            reelAssets.id,
            refs.map((ref) => ref.assetId),
          ),
        ),
      );

    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    for (const ref of refs) {
      const asset = assetMap.get(ref.assetId);
      if (!asset) {
        issues.push({
          code: "ASSET_OWNERSHIP_INVALID",
          track: ref.track,
          itemIds: [ref.itemId],
          severity: "error",
          message: "Referenced asset is missing or not owned by user.",
        });
        continue;
      }

      const allowedTypes = getAssetTypeForTrack(ref.track, ref.role);
      if (!allowedTypes.includes(asset.type)) {
        issues.push({
          code: "ASSET_TYPE_MISMATCH",
          track: ref.track,
          itemIds: [ref.itemId],
          severity: "error",
          message: `Asset type ${asset.type} is not valid for ${ref.track} track.`,
        });
      }
    }
  }

  const captionTracks = input.timeline.tracks.captions ?? [];
  for (const captionTrack of captionTracks) {
    const segmentsRaw = Array.isArray(captionTrack?.segments)
      ? (captionTrack.segments as Array<Record<string, unknown>>)
      : [];
    const normalized = segmentsRaw
      .map((segment) => ({
        id: String(segment.id ?? ""),
        startMs: Math.max(0, Number(segment.startMs ?? 0)),
        endMs: Math.max(0, Number(segment.endMs ?? 0)),
      }))
      .sort((a, b) => a.startMs - b.startMs);

    for (const segment of normalized) {
      if (segment.endMs <= segment.startMs) {
        issues.push({
          code: "CAPTION_INVALID_TIME_RANGE",
          track: "captions",
          itemIds: [segment.id].filter(Boolean),
          severity: "error",
          message: "Caption segment has invalid time range.",
        });
      }
      if (segment.startMs < 0 || segment.endMs > input.timeline.durationMs) {
        issues.push({
          code: "CAPTION_OUT_OF_BOUNDS",
          track: "captions",
          itemIds: [segment.id].filter(Boolean),
          severity: "error",
          message: "Caption segment must stay within composition duration.",
        });
      }
    }

    for (let i = 1; i < normalized.length; i += 1) {
      if (normalized[i].startMs < normalized[i - 1].endMs) {
        issues.push({
          code: "CAPTION_OVERLAP",
          track: "captions",
          itemIds: [normalized[i - 1].id, normalized[i].id].filter(Boolean),
          severity: "error",
          message: "Caption segments cannot overlap.",
        });
      }
    }
  }

  return issues;
}

async function buildInitialTimeline(input: {
  userId: string;
  generatedContentId: number;
}): Promise<TimelinePayload> {
  const videoAssets = await loadShotAssets(input.userId, input.generatedContentId);
  const auxAudio = await loadAuxAudioAssets(input.userId, input.generatedContentId);

  let cursor = 0;
  const video = videoAssets.map((asset, idx) => {
    const durationMs = Math.max(1, asset.durationMs ?? 5000);
    const item = {
      id: `clip-${idx + 1}`,
      assetId: asset.id,
      lane: 0,
      startMs: cursor,
      endMs: cursor + durationMs,
      trimStartMs: 0,
      trimEndMs: durationMs,
    };
    cursor += durationMs;
    return item;
  });

  const durationMs = Math.min(Math.max(cursor, 1000), MAX_COMPOSITION_DURATION_MS);
  const audio: Array<z.infer<typeof timelineItemSchema>> = [];

  if (auxAudio.voiceover) {
    audio.push({
      id: "voiceover-main",
      assetId: auxAudio.voiceover.id,
      role: "voiceover",
      startMs: 0,
      endMs: durationMs,
    });
  }
  if (auxAudio.music) {
    audio.push({
      id: "music-main",
      assetId: auxAudio.music.id,
      role: "music",
      startMs: 0,
      endMs: durationMs,
    });
  }

  return {
    schemaVersion: 1,
    fps: 30,
    durationMs,
    tracks: {
      video,
      audio,
      text: [],
      captions: [],
    },
  };
}

function normalizeTimelineForPersistence(timeline: TimelinePayload): TimelinePayload {
  const durationMs = Math.min(timeline.durationMs, MAX_COMPOSITION_DURATION_MS);
  const captions = (timeline.tracks.captions ?? []).map((track) => {
    const row = track as Record<string, unknown>;
    const rawSegments = Array.isArray(row.segments)
      ? (row.segments as Array<Record<string, unknown>>)
      : [];
    const segments = rawSegments.map((segment) => {
      const startMs = Math.min(
        durationMs,
        Math.max(0, Number(segment.startMs ?? 0)),
      );
      const endMs = Math.min(durationMs, Math.max(startMs, Number(segment.endMs ?? startMs)));
      return {
        ...segment,
        startMs,
        endMs,
      };
    });
    return {
      ...row,
      segments,
    };
  });

  return {
    ...timeline,
    durationMs,
    tracks: {
      ...timeline.tracks,
      captions,
    },
  };
}

async function ffmpegConcatClips(input: {
  signedClipUrls: string[];
  outputPath: string;
  workDir: string;
  useClipAudioByIndex?: boolean[];
}): Promise<void> {
  const listPath = join(input.workDir, "concat.txt");
  const tempPaths: string[] = [];
  const concatClipPaths: string[] = [];

  try {
    for (let i = 0; i < input.signedClipUrls.length; i += 1) {
      const clipPath = join(input.workDir, `clip-${i}-raw.mp4`);
      const res = await fetch(input.signedClipUrls[i]);
      if (!res.ok) {
        throw new Error(`Failed downloading clip ${i} (${res.status})`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await Bun.write(clipPath, buf);
      tempPaths.push(clipPath);

      const shouldKeepClipAudio = input.useClipAudioByIndex?.[i] ?? false;
      if (!shouldKeepClipAudio) {
        const mutedPath = join(input.workDir, `clip-${i}-muted.mp4`);
        const muteProc = Bun.spawn(
          ["ffmpeg", "-i", clipPath, "-c:v", "copy", "-an", "-y", mutedPath],
          {
            stderr: "pipe",
            stdout: "ignore",
          },
        );
        await muteProc.exited;
        if (muteProc.exitCode !== 0) {
          const fallbackMuteProc = Bun.spawn(
            [
              "ffmpeg",
              "-i",
              clipPath,
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-pix_fmt",
              "yuv420p",
              "-an",
              "-y",
              mutedPath,
            ],
            {
              stderr: "pipe",
              stdout: "ignore",
            },
          );
          await fallbackMuteProc.exited;
          if (fallbackMuteProc.exitCode !== 0) {
            const stderr = await new Response(fallbackMuteProc.stderr).text();
            throw new Error(
              `FFmpeg mute clip failed (exit ${fallbackMuteProc.exitCode}): ${stderr.slice(-500)}`,
            );
          }
        }
        tempPaths.push(mutedPath);
        concatClipPaths.push(mutedPath);
      } else {
        concatClipPaths.push(clipPath);
      }
    }

    await Bun.write(
      listPath,
      concatClipPaths.map((p) => `file '${p}'`).join("\n"),
    );

    const copyProc = Bun.spawn(
      [
        "ffmpeg",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        "-y",
        input.outputPath,
      ],
      {
        stderr: "pipe",
        stdout: "ignore",
      },
    );
    await copyProc.exited;

    if (copyProc.exitCode !== 0) {
      const reencodeProc = Bun.spawn(
        [
          "ffmpeg",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-pix_fmt",
          "yuv420p",
          "-an",
          "-y",
          input.outputPath,
        ],
        {
          stderr: "pipe",
          stdout: "ignore",
        },
      );
      await reencodeProc.exited;
      if (reencodeProc.exitCode !== 0) {
        const stderr = await new Response(reencodeProc.stderr).text();
        throw new Error(
          `FFmpeg concat failed (exit ${reencodeProc.exitCode}): ${stderr.slice(-500)}`,
        );
      }
    }
  } finally {
    await cleanupTempFiles([listPath, ...tempPaths]);
  }
}

function escapeAssText(text: string): string {
  return text.replace(/[{}]/g, "").replace(/\\/g, "\\\\");
}

async function createAssCaptions(input: {
  scriptText: string;
  totalDurationMs: number;
  outputPath: string;
}): Promise<boolean> {
  const words = input.scriptText.split(" ").filter(Boolean);
  if (words.length < 3) return false;

  const chunkSize = 3;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(
      words
        .slice(i, i + chunkSize)
        .join(" ")
        .toUpperCase(),
    );
  }
  if (chunks.length === 0) return false;

  const durationSec = Math.max(1, input.totalDurationMs / 1000);
  const segmentSec = Math.max(0.7, durationSec / chunks.length);
  const sizes = [48, 56, 52];

  const header = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Arial,48,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,2,0,2,60,60,180,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
`;

  const lines = chunks.map((chunk, idx) => {
    const start = idx * segmentSec;
    const end = Math.min(durationSec, start + segmentSec + 0.05);
    const fontSize = sizes[idx % sizes.length];
    return `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,{\\fs${fontSize}}${escapeAssText(chunk)}`;
  });

  await Bun.write(input.outputPath, `${header}${lines.join("\n")}\n`);
  return true;
}

async function runFfmpeg(args: string[]): Promise<void> {
  const proc = Bun.spawn(["ffmpeg", ...args], {
    stderr: "pipe",
    stdout: "ignore",
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(
      `FFmpeg failed (exit ${proc.exitCode}): ${stderr.slice(-500)}`,
    );
  }
}

async function ensureFfmpegAvailable(): Promise<void> {
  try {
    const proc = Bun.spawn(["ffmpeg", "-version"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
    if (proc.exitCode !== 0) {
      throw new Error("ffmpeg exited with non-zero status");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown ffmpeg error";
    throw new Error(
      `ffmpeg is required for video assembly but is unavailable: ${errorMessage}. Install ffmpeg on the host (or include it in the backend container image).`,
    );
  }
}

async function downloadSignedAssetToPath(
  r2Key: string,
  localPath: string,
): Promise<void> {
  const signedUrl = await getFileUrl(r2Key, 3600);
  const res = await fetch(signedUrl);
  if (!res.ok) {
    throw new Error(`Failed to download asset ${r2Key} (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await Bun.write(localPath, buffer);
}

async function loadAuxAudioAssets(
  userId: string,
  generatedContentId: number,
): Promise<AudioAssets> {
  const assets = await db
    .select()
    .from(reelAssets)
    .where(
      and(
        eq(reelAssets.userId, userId),
        eq(reelAssets.generatedContentId, generatedContentId),
      ),
    );

  const sorted = assets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const voiceover = sorted.find((asset) => asset.type === "voiceover") ?? null;
  const music = sorted.find((asset) => asset.type === "music") ?? null;
  return { voiceover, music };
}

async function mixAssemblyAudio(input: {
  inputVideoPath: string;
  outputPath: string;
  voiceoverPath?: string;
  musicPath?: string;
  keepClipAudio: boolean;
  clipAudioVolume: number;
  voiceoverVolume: number;
  musicVolume: number;
}): Promise<boolean> {
  const hasVoiceover = Boolean(input.voiceoverPath);
  const hasMusic = Boolean(input.musicPath);
  const hasClipAudio = input.keepClipAudio && input.clipAudioVolume > 0;
  if (!hasVoiceover && !hasMusic && input.keepClipAudio) return false;
  if (!hasVoiceover && !hasMusic && !hasClipAudio) {
    await runFfmpeg([
      "-i",
      input.inputVideoPath,
      "-an",
      "-c:v",
      "copy",
      "-y",
      input.outputPath,
    ]);
    return true;
  }

  const args = ["-i", input.inputVideoPath];
  if (input.voiceoverPath) args.push("-i", input.voiceoverPath);
  if (input.musicPath) args.push("-i", input.musicPath);
  const voiceoverInputIndex = input.voiceoverPath ? 1 : -1;
  const musicInputIndex = input.musicPath ? (input.voiceoverPath ? 2 : 1) : -1;

  if (hasClipAudio) {
    if (hasVoiceover && hasMusic) {
      args.push(
        "-filter_complex",
        `[0:a]volume=${input.clipAudioVolume}[clip];[${voiceoverInputIndex}:a]volume=${input.voiceoverVolume}[vo];[${musicInputIndex}:a]volume=${input.musicVolume}[music];[clip][vo][music]amix=inputs=3:duration=longest:dropout_transition=2[mix]`,
        "-map",
        "0:v",
        "-map",
        "[mix]",
      );
    } else if (hasVoiceover) {
      args.push(
        "-filter_complex",
        `[0:a]volume=${input.clipAudioVolume}[clip];[${voiceoverInputIndex}:a]volume=${input.voiceoverVolume}[vo];[clip][vo]amix=inputs=2:duration=longest:dropout_transition=2[mix]`,
        "-map",
        "0:v",
        "-map",
        "[mix]",
      );
    } else {
      args.push(
        "-filter_complex",
        `[0:a]volume=${input.clipAudioVolume}[clip];[${musicInputIndex}:a]volume=${input.musicVolume}[music];[clip][music]amix=inputs=2:duration=longest:dropout_transition=2[mix]`,
        "-map",
        "0:v",
        "-map",
        "[mix]",
      );
    }
  } else if (hasVoiceover && hasMusic) {
    args.push(
      "-filter_complex",
      `[${voiceoverInputIndex}:a]volume=${input.voiceoverVolume}[vo];[${musicInputIndex}:a]volume=${input.musicVolume}[music];[vo][music]amix=inputs=2:duration=longest:dropout_transition=2[mix]`,
      "-map",
      "0:v",
      "-map",
      "[mix]",
    );
  } else if (hasVoiceover) {
    args.push(
      "-filter_complex",
      `[${voiceoverInputIndex}:a]volume=${input.voiceoverVolume}[vo]`,
      "-map",
      "0:v",
      "-map",
      "[vo]",
    );
  } else {
    args.push(
      "-filter_complex",
      `[${musicInputIndex}:a]volume=${input.musicVolume}[music]`,
      "-map",
      "0:v",
      "-map",
      "[music]",
    );
  }

  args.push("-c:v", "copy", "-c:a", "aac", "-shortest", "-y", input.outputPath);
  await runFfmpeg(args);
  return true;
}

async function fetchOwnedContent(
  userId: string,
  generatedContentId: number,
): Promise<{
  id: number;
  prompt: string;
  generatedHook: string | null;
  generatedScript: string | null;
  cleanScriptForAudio: string | null;
  generatedMetadata: Record<string, unknown> | null;
} | null> {
  const [content] = await db
    .select({
      id: generatedContent.id,
      prompt: generatedContent.prompt,
      generatedHook: generatedContent.generatedHook,
      generatedScript: generatedContent.generatedScript,
      cleanScriptForAudio: generatedContent.cleanScriptForAudio,
      generatedMetadata: generatedContent.generatedMetadata,
    })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, generatedContentId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1);

  if (!content) return null;
  return {
    ...content,
    generatedMetadata:
      (content.generatedMetadata as Record<string, unknown> | null) ?? null,
  };
}

async function upsertAssembledAsset(input: {
  userId: string;
  generatedContentId: number;
  r2Key: string;
  r2Url: string;
  durationMs: number;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const [assembled] = await db
    .insert(reelAssets)
    .values({
      generatedContentId: input.generatedContentId,
      userId: input.userId,
      type: "assembled_video",
      r2Key: input.r2Key,
      r2Url: input.r2Url,
      durationMs: input.durationMs,
      metadata: input.metadata,
    })
    .returning({ id: reelAssets.id });

  return assembled.id;
}

async function loadShotAssets(userId: string, generatedContentId: number) {
  const assets = await db
    .select()
    .from(reelAssets)
    .where(
      and(
        eq(reelAssets.generatedContentId, generatedContentId),
        eq(reelAssets.userId, userId),
        eq(reelAssets.type, "video_clip"),
      ),
    );

  return assets.sort((a, b) => {
    const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    return ai - bi;
  });
}

async function updatePhase4Metadata(input: {
  generatedContentId: number;
  existingGeneratedMetadata: Record<string, unknown> | null;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  shots?: Array<{
    shotIndex: number;
    description: string;
    durationMs: number;
    assetId: string;
    useClipAudio: boolean;
  }>;
  provider?: string;
}) {
  const existingMetadata = input.existingGeneratedMetadata ?? {};
  const existingPhase4 =
    (existingMetadata.phase4 as Record<string, unknown> | null) ?? {};

  await db
    .update(generatedContent)
    .set({
      generatedMetadata: {
        ...existingMetadata,
        phase4: {
          ...existingPhase4,
          ...(input.shots ? { shots: input.shots } : {}),
          assembly: {
            jobId: input.jobId,
            status: input.status,
            ...(input.provider ? { provider: input.provider } : {}),
            updatedAt: new Date().toISOString(),
          },
        },
      },
    })
    .where(eq(generatedContent.id, input.generatedContentId));
}

async function runAssembleFromExistingClips({
  job,
}: {
  job: VideoRenderJob;
}): Promise<void> {
  await videoJobService.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
    progress: {
      phase: "decode",
      percent: 10,
      message: "Decoding and validating composition",
    },
  });

  try {
    const content = await fetchOwnedContent(job.userId, job.generatedContentId);
    if (!content) {
      throw new Error("Content not found");
    }

    await ensureFfmpegAvailable();

    const shotAssets = await loadShotAssets(job.userId, job.generatedContentId);
    if (shotAssets.length === 0) {
      throw new Error("No shot clips available for assembly");
    }

    const totalDurationMs = shotAssets.reduce(
      (acc, asset) => acc + (asset.durationMs ?? 0),
      0,
    );

    const workDir = join(tmpdir(), `phase4-assemble-${job.id}`);
    if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });
    const baseVideoPath = join(workDir, "base.mp4");
    const mixedVideoPath = join(workDir, "mixed.mp4");
    const captionedVideoPath = join(workDir, "captioned.mp4");
    const voiceoverPath = join(workDir, "voiceover.mp3");
    const musicPath = join(workDir, "music.mp3");
    const captionsPath = join(workDir, "captions.ass");

    let sourceType =
      shotAssets.length > 1 ? "phase4_ffmpeg_concat" : "phase4_single_clip";

    if (shotAssets.length > 1) {
      const signedClipUrls = await Promise.all(
        shotAssets.map((asset) => getFileUrl(asset.r2Key, 3600)),
      );
      const useClipAudioByIndex = deriveUseClipAudioByIndex(shotAssets);
      await ffmpegConcatClips({
        signedClipUrls,
        outputPath: baseVideoPath,
        workDir,
        useClipAudioByIndex,
      });
    } else {
      await downloadSignedAssetToPath(shotAssets[0].r2Key, baseVideoPath);
    }

    const shouldKeepClipAudio = shotAssets.some((asset) => {
      const metadata = (asset.metadata as Record<string, unknown> | null) ?? {};
      return Boolean(metadata.useClipAudio);
    });
    const requestedMix =
      (job.request?.audioMix as Record<string, unknown> | undefined) ?? {};
    const includeClipAudioOverride = requestedMix.includeClipAudio;
    const keepClipAudio =
      typeof includeClipAudioOverride === "boolean"
        ? includeClipAudioOverride
        : shouldKeepClipAudio;
    const clipAudioVolume =
      typeof requestedMix.clipAudioVolume === "number"
        ? Math.min(Math.max(requestedMix.clipAudioVolume, 0), 1)
        : keepClipAudio
          ? 0.35
          : 0;
    const voiceoverVolume =
      typeof requestedMix.voiceoverVolume === "number"
        ? Math.min(Math.max(requestedMix.voiceoverVolume, 0), 2)
        : 1.0;
    const musicVolume =
      typeof requestedMix.musicVolume === "number"
        ? Math.min(Math.max(requestedMix.musicVolume, 0), 1)
        : 0.22;

    const audioAssets = await loadAuxAudioAssets(
      job.userId,
      job.generatedContentId,
    );
    let workingVideoPath = baseVideoPath;
    let appliedAudioMix = false;

    if (audioAssets.voiceover) {
      await downloadSignedAssetToPath(
        audioAssets.voiceover.r2Key,
        voiceoverPath,
      );
    }
    if (audioAssets.music) {
      await downloadSignedAssetToPath(audioAssets.music.r2Key, musicPath);
    }

    if (audioAssets.voiceover || audioAssets.music || !keepClipAudio) {
      try {
        appliedAudioMix = await mixAssemblyAudio({
          inputVideoPath: workingVideoPath,
          outputPath: mixedVideoPath,
          voiceoverPath: audioAssets.voiceover ? voiceoverPath : undefined,
          musicPath: audioAssets.music ? musicPath : undefined,
          keepClipAudio,
          clipAudioVolume,
          voiceoverVolume,
          musicVolume,
        });
        if (appliedAudioMix) {
          workingVideoPath = mixedVideoPath;
          sourceType = `${sourceType}+audio_mix`;
        }
      } catch (mixError) {
        const errorMessage =
          mixError instanceof Error ? mixError.message : "Unknown mix error";
        debugLog.warn("Assembly audio mix failed; continuing without mix", {
          service: "video-route",
          operation: "runAssembleFromExistingClips",
          jobId: job.id,
          generatedContentId: job.generatedContentId,
          error: errorMessage,
        });
      }
    }

    const includeCaptions =
      (job.request?.includeCaptions as boolean | undefined) ?? true;
    const captionText = extractCaptionSourceText({
      cleanScriptForAudio: content.cleanScriptForAudio,
      generatedScript: content.generatedScript,
    });
    let captionsApplied = false;

    if (includeCaptions && captionText) {
      const hasCaptions = await createAssCaptions({
        scriptText: captionText,
        totalDurationMs: totalDurationMs || 5000,
        outputPath: captionsPath,
      });
      if (hasCaptions) {
        try {
          await runFfmpeg([
            "-i",
            workingVideoPath,
            "-vf",
            `ass=${captionsPath}`,
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "copy",
            "-y",
            captionedVideoPath,
          ]);
          workingVideoPath = captionedVideoPath;
          captionsApplied = true;
          sourceType = `${sourceType}+captions`;
        } catch (captionError) {
          const errorMessage =
            captionError instanceof Error
              ? captionError.message
              : "Unknown caption error";
          debugLog.warn(
            "Assembly caption burn failed; continuing without captions",
            {
              service: "video-route",
              operation: "runAssembleFromExistingClips",
              jobId: job.id,
              generatedContentId: job.generatedContentId,
              error: errorMessage,
            },
          );
        }
      }
    }

    const outputBuffer = Buffer.from(
      await Bun.file(workingVideoPath).arrayBuffer(),
    );
    const assembledR2Key = `assembled/${job.userId}/${job.generatedContentId}/${job.id}.mp4`;
    const assembledR2Url = await uploadFile(
      outputBuffer,
      assembledR2Key,
      "video/mp4",
    );
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    const assembledAssetId = await upsertAssembledAsset({
      userId: job.userId,
      generatedContentId: job.generatedContentId,
      r2Key: assembledR2Key,
      r2Url: assembledR2Url,
      durationMs: totalDurationMs || 5000,
      metadata: {
        sourceType,
        clipAssetId: shotAssets[0].id,
        clipCount: shotAssets.length,
        hasVoiceover: Boolean(audioAssets.voiceover),
        hasMusic: Boolean(audioAssets.music),
        useClipAudio: shouldKeepClipAudio,
        appliedAudioMix,
        captionsApplied,
      },
    });

    const videoUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${assembledR2Key}`
      : assembledR2Url;

    await db
      .update(generatedContent)
      .set({ videoR2Url: videoUrl })
      .where(eq(generatedContent.id, job.generatedContentId));

    await updatePhase4Metadata({
      generatedContentId: job.generatedContentId,
      existingGeneratedMetadata:
        (content.generatedMetadata as Record<string, unknown> | null) ?? null,
      jobId: job.id,
      status: "completed",
    });

    const signedVideoUrl = await getFileUrl(assembledR2Key, 3600).catch(
      () => videoUrl,
    );

    await videoJobService.updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: {
        assembledAssetId,
        videoUrl: signedVideoUrl,
        shotCount: shotAssets.length,
      },
      error: undefined,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await videoJobService.updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    });
    await updatePhase4Metadata({
      generatedContentId: job.generatedContentId,
      existingGeneratedMetadata: null,
      jobId: job.id,
      status: "failed",
    }).catch(() => {});

    debugLog.error("Assemble job failed", {
      service: "video-route",
      operation: "runAssembleFromExistingClips",
      jobId: job.id,
      generatedContentId: job.generatedContentId,
      error: errorMessage,
    });
  }
}

async function runReelGeneration(input: {
  job: VideoRenderJob;
  prompt?: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  provider?: VideoProvider;
}): Promise<void> {
  const { job } = input;
  await videoJobService.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  try {
    const content = await fetchOwnedContent(job.userId, job.generatedContentId);
    if (!content) {
      throw new Error("Content not found");
    }

    const fallbackPrompt =
      input.prompt?.trim() ||
      content.generatedHook?.trim() ||
      content.prompt?.trim();
    if (!fallbackPrompt) {
      throw new Error("No prompt available for video generation");
    }

    const shotsFromScript = parseScriptShots(content.generatedScript);
    const shots: ShotInput[] =
      shotsFromScript.length > 0
        ? shotsFromScript
        : [
            {
              shotIndex: 0,
              description: fallbackPrompt,
              durationSeconds: input.durationSeconds ?? 5,
            },
          ];

    const sceneDescription = content.generatedMetadata?.sceneDescription as
      | string
      | undefined;

    debugLog.info("[runReelGeneration] Starting clip generation", {
      service: "video-route",
      operation: "runReelGeneration",
      generatedContentId: job.generatedContentId,
      shotCount: shots.length,
      hasSceneDescription: !!sceneDescription,
      sceneDescription,
      shots: shots.map((s) => ({
        shotIndex: s.shotIndex,
        durationSeconds: s.durationSeconds,
        description: s.description,
      })),
    });

    const createdShots: Array<{
      shotIndex: number;
      description: string;
      durationMs: number;
      assetId: string;
      useClipAudio: boolean;
    }> = [];

    for (const shot of shots) {
      const videoPrompt = sceneDescription
        ? `${sceneDescription}. ${shot.description}`
        : shot.description;

      debugLog.info("[runReelGeneration] Sending prompt to video provider", {
        service: "video-route",
        operation: "runReelGeneration",
        shotIndex: shot.shotIndex,
        prompt: videoPrompt,
      });

      const clip = await generateVideoClip({
        prompt: videoPrompt,
        durationSeconds: shot.durationSeconds,
        aspectRatio: input.aspectRatio,
        userId: job.userId,
        providerOverride: input.provider,
        metadata: {
          generatedContentId: job.generatedContentId,
          shotIndex: shot.shotIndex,
        },
      });

      const [clipAsset] = await db
        .insert(reelAssets)
        .values({
          generatedContentId: job.generatedContentId,
          userId: job.userId,
          type: "video_clip",
          r2Key: clip.r2Key,
          r2Url: clip.r2Url,
          durationMs: clip.durationSeconds * 1000,
          metadata: {
            shotIndex: shot.shotIndex,
            sourceType: "ai_generated",
            provider: clip.provider,
            generationPrompt: shot.description,
            hasEmbeddedAudio: false,
            useClipAudio: false,
          },
        })
        .returning();

      createdShots.push({
        shotIndex: shot.shotIndex,
        description: shot.description,
        durationMs: clip.durationSeconds * 1000,
        assetId: clipAsset.id,
        useClipAudio: false,
      });
    }

    await updatePhase4Metadata({
      generatedContentId: job.generatedContentId,
      existingGeneratedMetadata: content.generatedMetadata,
      jobId: job.id,
      status: "running",
      shots: createdShots,
      provider: input.provider,
    });

    await runAssembleFromExistingClips({ job });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await videoJobService.updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    });

    debugLog.error("Video reel job failed", {
      service: "video-route",
      operation: "runReelGeneration",
      jobId: job.id,
      generatedContentId: job.generatedContentId,
      error: errorMessage,
    });
  }
}

async function runShotRegenerate(input: {
  job: VideoRenderJob;
  shotIndex: number;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  provider?: VideoProvider;
}): Promise<void> {
  const { job } = input;
  await videoJobService.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  try {
    const clip = await generateVideoClip({
      prompt: input.prompt,
      durationSeconds: input.durationSeconds ?? 5,
      aspectRatio: input.aspectRatio,
      userId: job.userId,
      providerOverride: input.provider,
      metadata: {
        generatedContentId: job.generatedContentId,
        shotIndex: input.shotIndex,
      },
    });

    const [clipAsset] = await db
      .insert(reelAssets)
      .values({
        generatedContentId: job.generatedContentId,
        userId: job.userId,
        type: "video_clip",
        r2Key: clip.r2Key,
        r2Url: clip.r2Url,
        durationMs: clip.durationSeconds * 1000,
        metadata: {
          shotIndex: input.shotIndex,
          sourceType: "ai_generated",
          provider: clip.provider,
          generationPrompt: input.prompt,
          hasEmbeddedAudio: false,
          useClipAudio: false,
        },
      })
      .returning();

    await runAssembleFromExistingClips({ job });

    const current = await videoJobService.getJob(job.id);
    if (current?.status === "completed") {
      await videoJobService.updateJob(job.id, {
        result: {
          ...(current.result ?? {}),
          clipAssetId: clipAsset.id,
          provider: clip.provider,
          durationSeconds: clip.durationSeconds,
        },
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await videoJobService.updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    });

    debugLog.error("Shot regenerate failed", {
      service: "video-route",
      operation: "runShotRegenerate",
      jobId: job.id,
      generatedContentId: job.generatedContentId,
      error: errorMessage,
    });
  }
}

async function runCompositionRender(input: {
  job: VideoRenderJob;
  compositionId: string;
  expectedVersion: number;
  includeCaptions: boolean;
  outputPreset: string;
}): Promise<void> {
  const { job } = input;
  await videoJobService.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  const lockKey = `phase5_render:${input.compositionId}:${input.expectedVersion}`;
  try {
    const [composition] = await db
      .select()
      .from(reelCompositions)
      .where(
        and(
          eq(reelCompositions.id, input.compositionId),
          eq(reelCompositions.userId, job.userId),
        ),
      )
      .limit(1);

    if (!composition) {
      throw new Error("Composition not found");
    }
    if (composition.version !== input.expectedVersion) {
      throw new Error("Composition version conflict");
    }

    const issues = await validateTimeline({
      userId: job.userId,
      generatedContentId: job.generatedContentId,
      timeline: composition.timeline as TimelinePayload,
    });
    if (issues.some((issue) => issue.severity === "error")) {
      throw new Error("Timeline validation failed");
    }

    await videoJobService.updateJob(job.id, {
      progress: {
        phase: "graph-build",
        percent: 45,
        message: "Building render graph",
      },
    });

    await runAssembleFromExistingClips({ job });

    const latestJob = await videoJobService.getJob(job.id);
    const assembledAssetId = latestJob?.result?.assembledAssetId;

    if (latestJob?.status === "completed" && assembledAssetId) {
      await videoJobService.updateJob(job.id, {
        progress: {
          phase: "encode",
          percent: 85,
          message: "Encoding final render",
        },
      });
      const versionLabel = `v${composition.version}-edited`;
      await db
        .update(reelAssets)
        .set({
          metadata: {
            ...(((await db
              .select({ metadata: reelAssets.metadata })
              .from(reelAssets)
              .where(eq(reelAssets.id, assembledAssetId))
              .limit(1))[0]?.metadata as Record<string, unknown> | null) ?? {}),
            sourceType: "phase5-composition",
            compositionId: composition.id,
            compositionVersion: composition.version,
            versionLabel,
            includeCaptions: input.includeCaptions,
            outputPreset: input.outputPreset,
          },
        })
        .where(eq(reelAssets.id, assembledAssetId));

      await db
        .update(reelCompositions)
        .set({
          latestRenderedAssetId: assembledAssetId,
        })
        .where(eq(reelCompositions.id, composition.id));

      await videoJobService.updateJob(job.id, {
        progress: {
          phase: "completed",
          percent: 100,
          message: "Render completed",
        },
        result: {
          ...(latestJob.result ?? {}),
          compositionId: composition.id,
          compositionVersion: composition.version,
        },
      });
    }
  } finally {
    await getRedisConnection().del(lockKey).catch(() => {});
  }
}

function enqueue(kind: VideoJobKind, fn: () => Promise<void>): void {
  setTimeout(() => void fn(), 0);
  debugLog.info("Video job enqueued", {
    service: "video-route",
    operation: "enqueue",
    kind,
  });
}

function getRetryRunner(
  job: VideoRenderJob,
  retryJob: VideoRenderJob,
): () => Promise<void> {
  const req = (job.request ?? {}) as Record<string, unknown>;
  const opts = {
    durationSeconds: req.durationSeconds
      ? Number(req.durationSeconds)
      : undefined,
    aspectRatio: req.aspectRatio as "9:16" | "16:9" | "1:1" | undefined,
    provider: req.provider as VideoProvider | undefined,
  };
  switch (job.kind) {
    case "assemble":
      return () => runAssembleFromExistingClips({ job: retryJob });
    case "composition_render":
      return () =>
        runCompositionRender({
          job: retryJob,
          compositionId: String(req.compositionId ?? ""),
          expectedVersion: Number(req.expectedVersion ?? 1),
          includeCaptions: Boolean(req.includeCaptions ?? true),
          outputPreset: String(req.outputPreset ?? "instagram-9-16"),
        });
    case "shot_regenerate":
      return () =>
        runShotRegenerate({
          job: retryJob,
          shotIndex: Number(req.shotIndex ?? 0),
          prompt: String(req.prompt ?? ""),
          ...opts,
        });
    default:
      return () =>
        runReelGeneration({
          job: retryJob,
          prompt: String(req.prompt ?? ""),
          ...opts,
        });
  }
}

// POST /api/video/reel
app.post(
  "/reel",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createReelSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const payload = c.req.valid("json");

      const content = await fetchOwnedContent(
        auth.user.id,
        payload.generatedContentId,
      );
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const resolvedPrompt =
        payload.prompt?.trim() ||
        content.generatedHook?.trim() ||
        content.prompt?.trim();
      if (!resolvedPrompt) {
        return c.json(
          {
            error: "No prompt available for video generation",
            code: "PHASE4_PROMPT_REQUIRED",
          },
          400,
        );
      }

      const job = await videoJobService.createJob({
        userId: auth.user.id,
        generatedContentId: payload.generatedContentId,
        kind: "reel_generate",
        request: {
          ...payload,
          prompt: resolvedPrompt,
        },
      });

      enqueue("reel_generate", () =>
        runReelGeneration({
          job,
          prompt: resolvedPrompt,
          durationSeconds: payload.durationSeconds,
          aspectRatio: payload.aspectRatio,
          provider: payload.provider,
        }),
      );

      return c.json(
        {
          jobId: job.id,
          status: job.status,
          generatedContentId: payload.generatedContentId,
        },
        202,
      );
    } catch (error) {
      debugLog.error("Failed to create reel job", {
        service: "video-route",
        operation: "createReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue reel generation" }, 500);
    }
  },
);

// POST /api/video/shots/regenerate
app.post(
  "/shots/regenerate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", regenerateShotSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const payload = c.req.valid("json");

      const content = await fetchOwnedContent(
        auth.user.id,
        payload.generatedContentId,
      );
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const job = await videoJobService.createJob({
        userId: auth.user.id,
        generatedContentId: payload.generatedContentId,
        kind: "shot_regenerate",
        request: payload,
      });

      enqueue("shot_regenerate", () =>
        runShotRegenerate({
          job,
          shotIndex: payload.shotIndex,
          prompt: payload.prompt,
          durationSeconds: payload.durationSeconds,
          aspectRatio: payload.aspectRatio,
          provider: payload.provider,
        }),
      );

      return c.json({ jobId: job.id, status: job.status }, 202);
    } catch (error) {
      debugLog.error("Failed to regenerate shot", {
        service: "video-route",
        operation: "regenerateShot",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue shot regeneration" }, 500);
    }
  },
);

// POST /api/video/assemble
app.post(
  "/assemble",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", assembleSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const payload = c.req.valid("json");

      const content = await fetchOwnedContent(
        auth.user.id,
        payload.generatedContentId,
      );
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const job = await videoJobService.createJob({
        userId: auth.user.id,
        generatedContentId: payload.generatedContentId,
        kind: "assemble",
        request: payload,
      });

      enqueue("assemble", () => runAssembleFromExistingClips({ job }));

      return c.json({ jobId: job.id, status: job.status }, 202);
    } catch (error) {
      debugLog.error("Failed to queue assembly", {
        service: "video-route",
        operation: "assemble",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue assembly" }, 500);
    }
  },
);

// POST /api/video/compositions/init
app.post(
  "/compositions/init",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", compositionInitSchema),
  async (c) => {
    const auth = c.get("auth");
    const payload = c.req.valid("json");

    const content = await fetchOwnedContent(auth.user.id, payload.generatedContentId);
    if (!content) {
      return c.json(
        {
          ok: false,
          error: {
            code: "GENERATED_CONTENT_NOT_FOUND",
            message: "Generated content not found",
          },
        },
        404,
      );
    }

    const [existing] = await db
      .select()
      .from(reelCompositions)
      .where(
        and(
          eq(reelCompositions.generatedContentId, payload.generatedContentId),
          eq(reelCompositions.userId, auth.user.id),
        ),
      )
      .limit(1);

    if (existing) {
      return c.json({
        ok: true,
        data: {
          compositionId: existing.id,
          generatedContentId: existing.generatedContentId,
          version: existing.version,
          mode: existing.editMode,
          timeline: existing.timeline,
          createdFromPhase4: false,
        },
      });
    }

    const timeline = await buildInitialTimeline({
      userId: auth.user.id,
      generatedContentId: payload.generatedContentId,
    });

    try {
      const [created] = await db
        .insert(reelCompositions)
        .values({
          generatedContentId: payload.generatedContentId,
          userId: auth.user.id,
          editMode: payload.mode,
          timeline,
        })
        .returning();

      return c.json({
        ok: true,
        data: {
          compositionId: created.id,
          generatedContentId: created.generatedContentId,
          version: created.version,
          mode: created.editMode,
          timeline: created.timeline,
          createdFromPhase4: true,
        },
      });
    } catch {
      const [raceResolved] = await db
        .select()
        .from(reelCompositions)
        .where(
          and(
            eq(reelCompositions.generatedContentId, payload.generatedContentId),
            eq(reelCompositions.userId, auth.user.id),
          ),
        )
        .limit(1);
      if (!raceResolved) {
        return c.json(
          {
            ok: false,
            error: {
              code: "COMPOSITION_INIT_FAILED",
              message: "Failed to initialize composition",
            },
          },
          409,
        );
      }

      return c.json({
        ok: true,
        data: {
          compositionId: raceResolved.id,
          generatedContentId: raceResolved.generatedContentId,
          version: raceResolved.version,
          mode: raceResolved.editMode,
          timeline: raceResolved.timeline,
          createdFromPhase4: false,
        },
      });
    }
  },
);

// GET /api/video/compositions/:compositionId
app.get(
  "/compositions/:compositionId",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const { compositionId } = c.req.param();

    const [composition] = await db
      .select()
      .from(reelCompositions)
      .where(
        and(
          eq(reelCompositions.id, compositionId),
          eq(reelCompositions.userId, auth.user.id),
        ),
      )
      .limit(1);

    if (!composition) {
      recordCompositionEvent("save", "error");
      return c.json(
        {
          ok: false,
          error: {
            code: "COMPOSITION_NOT_FOUND",
            message: "Composition not found",
          },
        },
        404,
      );
    }

    return c.json({
      ok: true,
      data: {
        compositionId: composition.id,
        generatedContentId: composition.generatedContentId,
        version: composition.version,
        editMode: composition.editMode,
        timeline: composition.timeline,
        updatedAt: composition.updatedAt,
      },
    });
  },
);

// PUT /api/video/compositions/:compositionId
app.put(
  "/compositions/:compositionId",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", compositionSaveSchema),
  async (c) => {
    const startedAt = Date.now();
    const auth = c.get("auth");
    const { compositionId } = c.req.param();
    const payload = c.req.valid("json");

    const [composition] = await db
      .select()
      .from(reelCompositions)
      .where(
        and(
          eq(reelCompositions.id, compositionId),
          eq(reelCompositions.userId, auth.user.id),
        ),
      )
      .limit(1);

    if (!composition) {
      return c.json(
        {
          ok: false,
          error: {
            code: "COMPOSITION_NOT_FOUND",
            message: "Composition not found",
          },
        },
        404,
      );
    }

    if (composition.version !== payload.expectedVersion) {
      recordCompositionEvent("save", "conflict");
      return c.json(
        {
          ok: false,
          error: {
            code: "COMPOSITION_VERSION_CONFLICT",
            message: "Composition has a newer version.",
            details: { latestVersion: composition.version },
          },
        },
        409,
      );
    }

    const normalizedTimeline = normalizeTimelineForPersistence(payload.timeline);

    const issues = await validateTimeline({
      userId: auth.user.id,
      generatedContentId: composition.generatedContentId,
      timeline: normalizedTimeline,
    });
    if (issues.some((issue) => issue.severity === "error")) {
      recordCompositionEvent("save", "validation_failed");
      return c.json(
        {
          ok: false,
          error: {
            code: "TIMELINE_VALIDATION_FAILED",
            message: "Timeline contains invalid segments.",
            details: { issues },
          },
        },
        422,
      );
    }

    const [updated] = await db
      .update(reelCompositions)
      .set({
        timeline: normalizedTimeline,
        editMode: payload.editMode,
        version: composition.version + 1,
      })
      .where(eq(reelCompositions.id, composition.id))
      .returning();

    const response = c.json({
      ok: true,
      data: {
        compositionId: updated.id,
        saved: true,
        version: updated.version,
        updatedAt: updated.updatedAt,
      },
    });
    recordCompositionEvent("save", "ok");
    recordCompositionLatency("save", Date.now() - startedAt);
    return response;
  },
);

// POST /api/video/compositions/:compositionId/validate
app.post(
  "/compositions/:compositionId/validate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", compositionValidateSchema),
  async (c) => {
    const startedAt = Date.now();
    const auth = c.get("auth");
    const { compositionId } = c.req.param();
    const payload = c.req.valid("json");

    const [composition] = await db
      .select({
        id: reelCompositions.id,
        generatedContentId: reelCompositions.generatedContentId,
      })
      .from(reelCompositions)
      .where(
        and(
          eq(reelCompositions.id, compositionId),
          eq(reelCompositions.userId, auth.user.id),
        ),
      )
      .limit(1);
    if (!composition) {
      recordCompositionEvent("validate", "error");
      return c.json(
        {
          ok: false,
          error: {
            code: "COMPOSITION_NOT_FOUND",
            message: "Composition not found",
          },
        },
        404,
      );
    }

    const normalizedTimeline = normalizeTimelineForPersistence(payload.timeline);
    const issues = await validateTimeline({
      userId: auth.user.id,
      generatedContentId: composition.generatedContentId,
      timeline: normalizedTimeline,
    });

    const response = c.json({
      ok: true,
      data: {
        valid: issues.every((issue) => issue.severity !== "error"),
        issues,
      },
    });
    recordCompositionEvent(
      "validate",
      issues.some((issue) => issue.severity === "error")
        ? "validation_failed"
        : "ok",
    );
    recordCompositionLatency("validate", Date.now() - startedAt);
    return response;
  },
);

// GET /api/video/compositions/:compositionId/versions
app.get(
  "/compositions/:compositionId/versions",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const { compositionId } = c.req.param();

    const [composition] = await db
      .select()
      .from(reelCompositions)
      .where(
        and(
          eq(reelCompositions.id, compositionId),
          eq(reelCompositions.userId, auth.user.id),
        ),
      )
      .limit(1);
    if (!composition) {
      return c.json(
        {
          ok: false,
          error: {
            code: "COMPOSITION_NOT_FOUND",
            message: "Composition not found",
          },
        },
        404,
      );
    }

    const assets = await db
      .select({
        id: reelAssets.id,
        createdAt: reelAssets.createdAt,
        durationMs: reelAssets.durationMs,
        metadata: reelAssets.metadata,
      })
      .from(reelAssets)
      .where(
        and(
          eq(reelAssets.userId, auth.user.id),
          eq(reelAssets.generatedContentId, composition.generatedContentId),
          eq(reelAssets.type, "assembled_video"),
        ),
      )
      .orderBy(desc(reelAssets.createdAt));

    return c.json({
      ok: true,
      data: {
        items: assets.map((asset) => ({
          assetId: asset.id,
          label:
            ((asset.metadata as Record<string, unknown> | null)?.versionLabel as
              | string
              | undefined) ?? "edited-version",
          createdAt: asset.createdAt,
          durationMs:
            asset.durationMs ??
            Number(
              (composition.timeline as Record<string, unknown>)?.durationMs ?? 0,
            ),
          isLatest: asset.id === composition.latestRenderedAssetId,
        })),
      },
    });
  },
);

// POST /api/video/compositions/:compositionId/render
app.post(
  "/compositions/:compositionId/render",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", compositionRenderSchema),
  async (c) => {
    const startedAt = Date.now();
    const auth = c.get("auth");
    const { compositionId } = c.req.param();
    const payload = c.req.valid("json");

    const [composition] = await db
      .select()
      .from(reelCompositions)
      .where(
        and(
          eq(reelCompositions.id, compositionId),
          eq(reelCompositions.userId, auth.user.id),
        ),
      )
      .limit(1);
    if (!composition) {
      return c.json(
        {
          ok: false,
          error: {
            code: "COMPOSITION_NOT_FOUND",
            message: "Composition not found",
          },
        },
        404,
      );
    }

    if (composition.version !== payload.expectedVersion) {
      recordCompositionEvent("render", "conflict");
      return c.json(
        {
          ok: false,
          error: {
            code: "COMPOSITION_VERSION_CONFLICT",
            message: "Composition has a newer version.",
            details: { latestVersion: composition.version },
          },
        },
        409,
      );
    }

    const issues = await validateTimeline({
      userId: auth.user.id,
      generatedContentId: composition.generatedContentId,
      timeline: composition.timeline as TimelinePayload,
    });
    if (issues.some((issue) => issue.severity === "error")) {
      recordCompositionEvent("render", "validation_failed");
      return c.json(
        {
          ok: false,
          error: {
            code: "TIMELINE_VALIDATION_FAILED",
            message: "Timeline contains invalid segments.",
            details: { issues },
          },
        },
        422,
      );
    }

    const lockKey = `phase5_render:${composition.id}:${composition.version}`;
    const existingJobId = await getRedisConnection().get(lockKey);
    if (existingJobId) {
      const existingJob = await videoJobService.getJob(existingJobId);
      if (
        existingJob &&
        (existingJob.status === "queued" || existingJob.status === "running")
      ) {
        return c.json(
          {
            ok: true,
            data: {
              jobId: existingJob.id,
              status: existingJob.status,
              compositionId: composition.id,
              compositionVersion: composition.version,
            },
          },
          202,
        );
      }
    }

    const job = await videoJobService.createJob({
      userId: auth.user.id,
      generatedContentId: composition.generatedContentId,
      kind: "composition_render",
      request: {
        compositionId: composition.id,
        expectedVersion: composition.version,
        includeCaptions: payload.includeCaptions,
        outputPreset: payload.outputPreset,
      },
    });

    await getRedisConnection().set(lockKey, job.id, "EX", 600);
    enqueue("composition_render", () =>
      runCompositionRender({
        job,
        compositionId: composition.id,
        expectedVersion: composition.version,
        includeCaptions: payload.includeCaptions,
        outputPreset: payload.outputPreset,
      }),
    );

    const response = c.json(
      {
        ok: true,
        data: {
          jobId: job.id,
          status: job.status,
          compositionId: composition.id,
          compositionVersion: composition.version,
        },
      },
      202,
    );
    recordCompositionEvent("render", "ok");
    recordCompositionLatency("render", Date.now() - startedAt);
    return response;
  },
);

// GET /api/video/composition-jobs/:jobId
app.get(
  "/composition-jobs/:jobId",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const { jobId } = c.req.param();
    const job = await videoJobService.getJob(jobId);

    if (!job) {
      return c.json(
        {
          ok: false,
          error: { code: "COMPOSITION_JOB_NOT_FOUND", message: "Job not found" },
        },
        404,
      );
    }
    if (job.userId !== auth.user.id) {
      return c.json(
        {
          ok: false,
          error: { code: "OWNERSHIP_FORBIDDEN", message: "Forbidden" },
        },
        403,
      );
    }

    if (job.status === "failed") {
      return c.json({
        ok: false,
        error: {
          code: "COMPOSITION_RENDER_FAILED",
          message: job.error ?? "Render failed",
          details: { retryable: true },
        },
      });
    }

    return c.json({
      ok: true,
      data: {
        jobId: job.id,
        status: job.status === "running" ? "rendering" : job.status,
        progress: job.progress,
        result: job.result,
      },
    });
  },
);

// POST /api/video/composition-jobs/:jobId/retry
app.post(
  "/composition-jobs/:jobId/retry",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const { jobId } = c.req.param();
    const job = await videoJobService.getJob(jobId);

    if (!job) {
      return c.json(
        {
          ok: false,
          error: { code: "COMPOSITION_JOB_NOT_FOUND", message: "Job not found" },
        },
        404,
      );
    }
    if (job.userId !== auth.user.id) {
      return c.json(
        {
          ok: false,
          error: { code: "OWNERSHIP_FORBIDDEN", message: "Forbidden" },
        },
        403,
      );
    }
    if (job.kind !== "composition_render") {
      return c.json(
        {
          ok: false,
          error: { code: "INVALID_INPUT", message: "Not a composition render job" },
        },
        400,
      );
    }
    if (job.status !== "failed" && job.status !== "completed") {
      return c.json(
        {
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message: "Retry allowed only for terminal jobs",
          },
        },
        400,
      );
    }

    const retryJob = await videoJobService.createJob({
      userId: job.userId,
      generatedContentId: job.generatedContentId,
      kind: "composition_render",
      request: job.request,
    });
    enqueue("composition_render", getRetryRunner(job, retryJob));
    recordCompositionEvent("render_retry", "ok");

    return c.json(
      {
        ok: true,
        data: {
          jobId: retryJob.id,
          status: retryJob.status,
        },
      },
      202,
    );
  },
);

// GET /api/video/jobs/:jobId
app.get(
  "/jobs/:jobId",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { jobId } = c.req.param();

      const job = await videoJobService.getJob(jobId);
      if (!job) {
        return c.json(
          { error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" },
          404,
        );
      }

      if (job.userId !== auth.user.id) {
        return c.json({ error: "Forbidden", code: "PHASE4_FORBIDDEN" }, 403);
      }

      return c.json({ job });
    } catch (error) {
      debugLog.error("Failed to fetch video job", {
        service: "video-route",
        operation: "getJob",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch job status" }, 500);
    }
  },
);

// POST /api/video/jobs/:jobId/retry
app.post(
  "/jobs/:jobId/retry",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { jobId } = c.req.param();
      const job = await videoJobService.getJob(jobId);

      if (!job) {
        return c.json(
          { error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" },
          404,
        );
      }

      if (job.userId !== auth.user.id) {
        return c.json({ error: "Forbidden", code: "PHASE4_FORBIDDEN" }, 403);
      }

      const retryJob = await videoJobService.createJob({
        userId: job.userId,
        generatedContentId: job.generatedContentId,
        kind: job.kind,
        request: job.request,
      });

      enqueue(job.kind, getRetryRunner(job, retryJob));

      return c.json({ jobId: retryJob.id, status: retryJob.status }, 202);
    } catch (error) {
      debugLog.error("Failed to retry video job", {
        service: "video-route",
        operation: "retryJob",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to retry job" }, 500);
    }
  },
);

export const __videoRouteTestUtils = {
  parseScriptShots,
  extractCaptionSourceText,
  deriveUseClipAudioByIndex,
  formatAssTime,
};

export default app;
