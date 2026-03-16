import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
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
});

type ShotInput = {
  shotIndex: number;
  description: string;
  durationSeconds: number;
};

type AudioAssets = {
  voiceover: (typeof reelAssets.$inferSelect) | null;
  music: (typeof reelAssets.$inferSelect) | null;
};

async function cleanupTempFiles(paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      // Ignore cleanup errors
    }
  }
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
          [
            "ffmpeg",
            "-i",
            clipPath,
            "-c:v",
            "copy",
            "-an",
            "-y",
            mutedPath,
          ],
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

    await Bun.write(listPath, concatClipPaths.map((p) => `file '${p}'`).join("\n"));

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

function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.floor((clamped - Math.floor(clamped)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function extractCaptionSourceText(input: {
  cleanScriptForAudio: string | null;
  generatedScript: string | null;
}): string {
  const source = (input.cleanScriptForAudio ?? input.generatedScript ?? "").trim();
  if (!source) return "";
  return source
    .replace(/^\[[^\]]+\]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
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
    chunks.push(words.slice(i, i + chunkSize).join(" ").toUpperCase());
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
}): Promise<boolean> {
  const hasVoiceover = Boolean(input.voiceoverPath);
  const hasMusic = Boolean(input.musicPath);
  if (!hasVoiceover && !hasMusic && input.keepClipAudio) return false;
  if (!hasVoiceover && !hasMusic && !input.keepClipAudio) {
    await runFfmpeg(["-i", input.inputVideoPath, "-an", "-c:v", "copy", "-y", input.outputPath]);
    return true;
  }

  const args = ["-i", input.inputVideoPath];
  if (input.voiceoverPath) args.push("-i", input.voiceoverPath);
  if (input.musicPath) args.push("-i", input.musicPath);

  if (input.keepClipAudio) {
    if (hasVoiceover && hasMusic) {
      args.push(
        "-filter_complex",
        "[0:a]volume=0.35[clip];[1:a]volume=1.0[vo];[2:a]volume=0.22[music];[clip][vo][music]amix=inputs=3:duration=longest:dropout_transition=2[mix]",
        "-map",
        "0:v",
        "-map",
        "[mix]",
      );
    } else if (hasVoiceover) {
      args.push(
        "-filter_complex",
        "[0:a]volume=0.4[clip];[1:a]volume=1.0[vo];[clip][vo]amix=inputs=2:duration=longest:dropout_transition=2[mix]",
        "-map",
        "0:v",
        "-map",
        "[mix]",
      );
    } else {
      args.push(
        "-filter_complex",
        "[0:a]volume=0.45[clip];[1:a]volume=0.25[music];[clip][music]amix=inputs=2:duration=longest:dropout_transition=2[mix]",
        "-map",
        "0:v",
        "-map",
        "[mix]",
      );
    }
  } else if (hasVoiceover && hasMusic) {
    args.push(
      "-filter_complex",
      "[1:a]volume=1.0[vo];[2:a]volume=0.22[music];[vo][music]amix=inputs=2:duration=longest:dropout_transition=2[mix]",
      "-map",
      "0:v",
      "-map",
      "[mix]",
    );
  } else if (hasVoiceover) {
    args.push("-map", "0:v", "-map", "1:a");
  } else {
    args.push("-map", "0:v", "-map", "1:a");
  }

  args.push("-c:v", "copy", "-c:a", "aac", "-shortest", "-y", input.outputPath);
  await runFfmpeg(args);
  return true;
}

function parseScriptShots(script: string | null): ShotInput[] {
  if (!script) return [];

  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  const shots: ShotInput[] = [];
  const timingRegex = /^\[(\d+)(?::\d+)?-(\d+)(?::\d+)?s?\]\s*(.+)$/i;

  for (const line of lines) {
    const m = line.match(timingRegex);
    if (!m) continue;
    const start = Number(m[1]);
    const end = Number(m[2]);
    const text = m[3]?.trim();
    if (!text) continue;
    const durationSeconds = Math.max(3, Math.min(10, end - start || 5));
    shots.push({
      shotIndex: shots.length,
      description: text,
      durationSeconds,
    });
  }

  return shots.slice(0, 12);
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
  const [existing] = await db
    .select({ id: reelAssets.id })
    .from(reelAssets)
    .where(
      and(
        eq(reelAssets.generatedContentId, input.generatedContentId),
        eq(reelAssets.userId, input.userId),
        eq(reelAssets.type, "assembled_video"),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(reelAssets)
      .set({
        r2Key: input.r2Key,
        r2Url: input.r2Url,
        durationMs: input.durationMs,
        metadata: input.metadata,
      })
      .where(eq(reelAssets.id, existing.id))
      .returning({ id: reelAssets.id });
    return updated.id;
  }

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
  });

  try {
    const content = await fetchOwnedContent(job.userId, job.generatedContentId);
    if (!content) {
      throw new Error("Content not found");
    }

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
      const useClipAudioByIndex = shotAssets.map((asset) => {
        const metadata = (asset.metadata as Record<string, unknown> | null) ?? {};
        return Boolean(metadata.useClipAudio);
      });
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

    const audioAssets = await loadAuxAudioAssets(job.userId, job.generatedContentId);
    let workingVideoPath = baseVideoPath;
    let appliedAudioMix = false;

    if (audioAssets.voiceover) {
      await downloadSignedAssetToPath(audioAssets.voiceover.r2Key, voiceoverPath);
    }
    if (audioAssets.music) {
      await downloadSignedAssetToPath(audioAssets.music.r2Key, musicPath);
    }

    if (
      audioAssets.voiceover ||
      audioAssets.music ||
      !shouldKeepClipAudio
    ) {
      try {
        appliedAudioMix = await mixAssemblyAudio({
          inputVideoPath: workingVideoPath,
          outputPath: mixedVideoPath,
          voiceoverPath: audioAssets.voiceover ? voiceoverPath : undefined,
          musicPath: audioAssets.music ? musicPath : undefined,
          keepClipAudio: shouldKeepClipAudio,
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
          debugLog.warn("Assembly caption burn failed; continuing without captions", {
            service: "video-route",
            operation: "runAssembleFromExistingClips",
            jobId: job.id,
            generatedContentId: job.generatedContentId,
            error: errorMessage,
          });
        }
      }
    }

    const outputBuffer = Buffer.from(await Bun.file(workingVideoPath).arrayBuffer());
    const assembledR2Key = `assembled/${job.userId}/${job.generatedContentId}/${job.id}.mp4`;
    const assembledR2Url = await uploadFile(outputBuffer, assembledR2Key, "video/mp4");
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
      input.prompt?.trim() || content.generatedHook?.trim() || content.prompt?.trim();
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

    const createdShots: Array<{
      shotIndex: number;
      description: string;
      durationMs: number;
      assetId: string;
      useClipAudio: boolean;
    }> = [];

    for (const shot of shots) {
      const clip = await generateVideoClip({
        prompt: shot.description,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
    durationSeconds: req.durationSeconds ? Number(req.durationSeconds) : undefined,
    aspectRatio: req.aspectRatio as "9:16" | "16:9" | "1:1" | undefined,
    provider: req.provider as VideoProvider | undefined,
  };
  switch (job.kind) {
    case "assemble":
      return () => runAssembleFromExistingClips({ job: retryJob });
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

      const content = await fetchOwnedContent(auth.user.id, payload.generatedContentId);
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const resolvedPrompt =
        payload.prompt?.trim() || content.generatedHook?.trim() || content.prompt?.trim();
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

      const content = await fetchOwnedContent(auth.user.id, payload.generatedContentId);
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

      const content = await fetchOwnedContent(auth.user.id, payload.generatedContentId);
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
        return c.json({ error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" }, 404);
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
        return c.json({ error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" }, 404);
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

export default app;
