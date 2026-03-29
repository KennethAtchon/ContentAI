import { eq, and, inArray } from "drizzle-orm";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { exportJobs, assets } from "../../infrastructure/database/drizzle/schema";
import { db } from "../../services/db/db";
import { getFileUrl, uploadFile } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import { buildFfmpegAtempoChain } from "../../domain/editor/timeline/composition";
import { generateASS } from "./export/ass-generator";

interface ClipData {
  id?: string;
  assetId: string | null;
  r2Key?: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  volume: number;
  muted: boolean;
  textContent?: string;
  positionX?: number;
  positionY?: number;
  scale?: number;
  captionWords?: Array<{ word: string; startMs: number; endMs: number }>;
  captionPresetId?: string;
  captionGroupSize?: number;
  captionPositionY?: number;
  captionFontSizeOverride?: number;
  contrast?: number;
  warmth?: number;
  opacity?: number;
}

interface TransitionData {
  id: string;
  type: "fade" | "slide-left" | "slide-up" | "dissolve" | "wipe-right" | "none";
  durationMs: number;
  clipAId: string;
  clipBId: string;
}

interface TrackData {
  id?: string;
  type: "video" | "audio" | "music" | "text";
  muted: boolean;
  clips: ClipData[];
  transitions?: TransitionData[];
}

async function setJobProgress(
  jobId: string,
  progress: number,
  status = "rendering",
) {
  await db
    .update(exportJobs)
    .set({ progress, status })
    .where(eq(exportJobs.id, jobId));
}

/**
 * FFmpeg export pipeline — timeline semantics (trim, per-clip speed via setpts,
 * transitions) should stay aligned with the SPA preview module
 * `frontend/src/features/editor/utils/editor-composition.ts` and preview hooks;
 * update both sides when changing how clips map from timeline time to media time.
 */
export async function runExportJob(
  jobId: string,
  project: {
    id: string;
    tracks: unknown;
    durationMs: number;
    fps: number;
    resolution: string;
  },
  userId: string,
  opts: { resolution?: string; fps?: number },
) {
  const tmpFiles: string[] = [];

  try {
    await db
      .update(exportJobs)
      .set({ status: "rendering", progress: 5 })
      .where(eq(exportJobs.id, jobId));

    const tracks = (project.tracks as TrackData[]) ?? [];
    const fps = opts.fps ?? project.fps ?? 30;
    const resolution = opts.resolution ?? project.resolution ?? "1080x1920";
    const resolutionMap: Record<string, [number, number]> = {
      "1080x1920": [1080, 1920],
      "720x1280": [720, 1280],
      "2160x3840": [2160, 3840],
      "1920x1080": [1920, 1080],
      "1080x1080": [1080, 1080],
    };
    const [outW, outH] = resolutionMap[resolution] ?? [1080, 1920];

    const assetIds = tracks
      .flatMap((t) => t.clips)
      .map((c) => c.assetId)
      .filter((id): id is string => !!id);

    let assetsMap: Record<string, { r2Key: string; type: string }> = {};
    if (assetIds.length > 0) {
      const assetRows = await db
        .select({
          id: assets.id,
          r2Key: assets.r2Key,
          type: assets.type,
        })
        .from(assets)
        .where(and(inArray(assets.id, assetIds), eq(assets.userId, userId)));
      assetsMap = Object.fromEntries(
        assetRows.map((a) => [a.id, { r2Key: a.r2Key!, type: a.type }]),
      );
    }

    await setJobProgress(jobId, 20);

    const videoTracks = tracks.filter((t) => t.type === "video");
    const audioTrack = tracks.find((t) => t.type === "audio" && !t.muted);
    const musicTrack = tracks.find((t) => t.type === "music" && !t.muted);
    const textTrack = tracks.find((t) => t.type === "text");

    const videoClipsWithTrack = videoTracks.flatMap((t, trackIndex) =>
      t.clips
        .filter((c) => c.assetId && assetsMap[c.assetId!])
        .map((c) => ({ clip: c, trackIndex })),
    );
    videoClipsWithTrack.sort((a, b) => {
      if (a.clip.startMs !== b.clip.startMs)
        return a.clip.startMs - b.clip.startMs;
      return a.trackIndex - b.trackIndex;
    });
    const videoClips = videoClipsWithTrack.map((x) => x.clip);
    const clipTrackIndex = new Map<string, number>();
    for (const { clip, trackIndex } of videoClipsWithTrack) {
      if (clip.id) clipTrackIndex.set(clip.id, trackIndex);
    }
    const videoTransitions = videoTracks.flatMap((t) => t.transitions ?? []);
    const audioClips = (audioTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );
    const musicClips = (musicTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );

    if (videoClips.length === 0) {
      await db
        .update(exportJobs)
        .set({ status: "failed", error: "No video clips on timeline" })
        .where(eq(exportJobs.id, jobId));
      return;
    }

    const downloadToTmp = async (
      r2Key: string,
      ext: string,
    ): Promise<string> => {
      const signedUrl = await getFileUrl(r2Key, 3600);
      const res = await fetch(signedUrl);
      if (!res.ok)
        throw new Error(`Failed to download ${r2Key}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const path = join(
        tmpdir(),
        `export-${jobId}-${crypto.randomUUID()}.${ext}`,
      );
      writeFileSync(path, buf);
      tmpFiles.push(path);
      return path;
    };

    const ffmpegInputs: string[] = [];
    const clipPaths: string[] = [];

    for (const clip of videoClips) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp4";
      const path = await downloadToTmp(asset.r2Key, ext);
      clipPaths.push(path);
      ffmpegInputs.push("-i", path);
    }

    await setJobProgress(jobId, 40);

    for (const clip of [...audioClips, ...musicClips]) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp3";
      const path = await downloadToTmp(asset.r2Key, ext);
      ffmpegInputs.push("-i", path);
    }

    const filterParts: string[] = [];
    const videoInputCount = videoClips.length;

    videoClips.forEach((clip, i) => {
      const trimStart = (clip.trimStartMs ?? 0) / 1000;
      const pts =
        clip.speed && clip.speed !== 1
          ? `setpts=${(1 / clip.speed).toFixed(4)}*PTS,`
          : "";

      const colorFilters: string[] = [];
      if (clip.contrast && clip.contrast !== 0) {
        colorFilters.push(`eq=contrast=${1 + clip.contrast / 100}`);
      }
      if (clip.warmth && clip.warmth !== 0) {
        const warmShift = clip.warmth / 200;
        colorFilters.push(`colorbalance=rs=${warmShift}:bs=${-warmShift}`);
      }
      if (clip.opacity !== undefined && clip.opacity !== 1) {
        colorFilters.push(
          `format=yuva420p,colorchannelmixer=aa=${clip.opacity}`,
        );
      }
      const colorStr =
        colorFilters.length > 0 ? colorFilters.join(",") + "," : "";

      filterParts.push(
        `[${i}:v]trim=start=${trimStart}:duration=${clip.durationMs / 1000},` +
          `${pts}scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
          `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black,${colorStr}setpts=PTS-STARTPTS[v${i}]`,
      );
    });

    const textClips = textTrack?.clips ?? [];
    let latestVideoLabel = "";

    if (videoInputCount === 1) {
      latestVideoLabel = "v0";
    } else {
      const xfadeTypeMap: Record<string, string> = {
        fade: "fade",
        "slide-left": "slideleft",
        "slide-up": "slideup",
        dissolve: "dissolve",
        "wipe-right": "wiperight",
      };

      let currentLabel = "[v0]";
      let accumulatedDuration = videoClips[0].durationMs / 1000;

      for (let i = 1; i < videoClips.length; i++) {
        const clipA = videoClips[i - 1];
        const clipB = videoClips[i];
        const sameOriginalTrack =
          clipA.id != null &&
          clipB.id != null &&
          clipTrackIndex.get(clipA.id) === clipTrackIndex.get(clipB.id);
        const trans = sameOriginalTrack
          ? videoTransitions.find(
              (tr) => tr.clipAId === clipA.id && tr.clipBId === clipB.id,
            )
          : undefined;

        const isLast = i === videoClips.length - 1;
        const outLabel = isLast ? "[vjoined]" : `[vx${i}]`;

        if (trans && trans.type !== "none" && xfadeTypeMap[trans.type]) {
          const xfadeType = xfadeTypeMap[trans.type];
          const transDurSec = trans.durationMs / 1000;
          const offset = accumulatedDuration - transDurSec;

          filterParts.push(
            `${currentLabel}[v${i}]xfade=transition=${xfadeType}:duration=${transDurSec}:offset=${offset.toFixed(4)}${outLabel}`,
          );
          accumulatedDuration += clipB.durationMs / 1000 - transDurSec;
        } else {
          const offset = accumulatedDuration;
          filterParts.push(
            `${currentLabel}[v${i}]xfade=transition=fade:duration=0.001:offset=${offset.toFixed(4)}${outLabel}`,
          );
          accumulatedDuration += clipB.durationMs / 1000;
        }
        currentLabel = outLabel;
      }
      latestVideoLabel = "vjoined";
    }

    textClips.forEach((clip, i) => {
      if (!clip.textContent) return;
      const startSec = clip.startMs / 1000;
      const endSec = (clip.startMs + clip.durationMs) / 1000;
      const x = clip.positionX ?? 0;
      const y = clip.positionY ?? 0;
      const label = `vtxt${i}`;
      const prevLabel = i === 0 ? latestVideoLabel : `vtxt${i - 1}`;
      const textFilePath = join(tmpdir(), `export-${jobId}-text-${i}.txt`);
      writeFileSync(textFilePath, clip.textContent);
      tmpFiles.push(textFilePath);
      filterParts.push(
        `[${prevLabel}]drawtext=textfile='${textFilePath}':fontsize=48:fontcolor=white:` +
          `x=${x}:y=${y}:enable='between(t,${startSec},${endSec})'[${label}]`,
      );
      latestVideoLabel = label;
    });

    const captionClips = textClips.filter(
      (c: ClipData) => c.captionWords?.length && c.captionPresetId,
    );

    if (captionClips.length > 0) {
      for (const captionClip of captionClips) {
        const assContent = generateASS(
          captionClip.captionWords ?? [],
          captionClip.captionPresetId!,
          [outW, outH],
          captionClip.captionGroupSize ?? 3,
          captionClip.startMs ?? 0,
        );

        const assPath = join(
          tmpdir(),
          `export-${jobId}-captions-${crypto.randomUUID()}.ass`,
        );
        writeFileSync(assPath, assContent, "utf-8");
        tmpFiles.push(assPath);

        const assLabel = `vcap${captionClips.indexOf(captionClip)}`;
        filterParts.push(
          `[${latestVideoLabel}]ass='${assPath.replace(/'/g, "'\\''")}'[${assLabel}]`,
        );
        latestVideoLabel = assLabel;
      }
    }

    const allAudioClips = [...audioClips, ...musicClips];
    let finalAudioLabel = "";
    if (allAudioClips.length > 0) {
      allAudioClips.forEach((clip, i) => {
        const inputIdx = videoInputCount + i;
        const vol = (clip.muted ? 0 : (clip.volume ?? 1)).toFixed(2);
        const trimStart = (clip.trimStartMs ?? 0) / 1000;
        const durSec = clip.durationMs / 1000;
        const atempo = buildFfmpegAtempoChain(clip.speed ?? 1);
        const tempoPart = atempo ? `,${atempo}` : "";
        filterParts.push(
          `[${inputIdx}:a]atrim=start=${trimStart}:duration=${durSec},asetpts=PTS-STARTPTS${tempoPart},volume=${vol}[a${i}]`,
        );
      });
      if (allAudioClips.length > 1) {
        const amixInputs = allAudioClips.map((_, i) => `[a${i}]`).join("");
        filterParts.push(
          `${amixInputs}amix=inputs=${allAudioClips.length}[amix]`,
        );
        finalAudioLabel = "amix";
      } else {
        finalAudioLabel = "a0";
      }
    }

    const tmpOut = join(tmpdir(), `export-${jobId}-out.mp4`);
    tmpFiles.push(tmpOut);

    const ffmpegArgs = [
      ...ffmpegInputs,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      `[${latestVideoLabel}]`,
    ];

    if (finalAudioLabel) {
      ffmpegArgs.push("-map", `[${finalAudioLabel}]`);
    }

    ffmpegArgs.push(
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "fast",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
    );

    if (finalAudioLabel) {
      ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
    }

    ffmpegArgs.push("-y", tmpOut);

    await setJobProgress(jobId, 55);

    const proc = Bun.spawn(["ffmpeg", ...ffmpegArgs], {
      stderr: "pipe",
      stdout: "ignore",
    });

    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(
        `FFmpeg failed (exit ${proc.exitCode}): ${stderr.slice(-800)}`,
      );
    }

    await setJobProgress(jobId, 85);

    const outBuffer = Buffer.from(await Bun.file(tmpOut).arrayBuffer());
    const r2Key = `exports/${userId}/${project.id}/${jobId}.mp4`;
    const r2Url = await uploadFile(outBuffer, r2Key, "video/mp4");

    const [outputAsset] = await db
      .insert(assets)
      .values({
        userId,
        type: "assembled_video",
        source: "export",
        r2Key,
        r2Url,
        sizeBytes: outBuffer.length,
        metadata: { editProjectId: project.id, jobId, resolution, fps },
      })
      .returning({ id: assets.id });

    await db
      .update(exportJobs)
      .set({ status: "done", progress: 100, outputAssetId: outputAsset.id })
      .where(eq(exportJobs.id, jobId));

    debugLog.info("Export job completed", {
      service: "editor-route",
      operation: "runExportJob",
      jobId,
      r2Key,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(exportJobs)
      .set({ status: "failed", error: message.slice(0, 500) })
      .where(eq(exportJobs.id, jobId))
      .catch(() => {});

    debugLog.error("Export job failed", {
      service: "editor-route",
      operation: "runExportJob",
      jobId,
      error: message,
    });
  } finally {
    for (const f of tmpFiles) {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}
