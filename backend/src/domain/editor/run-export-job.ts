import { existsSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { NewAssetRow } from "../assets/assets.repository";
import { buildPages } from "./captions/page-builder";
import { applyOverrides } from "./captions/preset.repository";
import { sliceTokensToRange } from "./captions/slice-tokens";
import {
  deriveAssStyleName,
  generateASS,
  serializeASS,
} from "./export/ass-exporter";
import type { Token } from "../../infrastructure/database/drizzle/schema";
import type {
  AudioClip,
  CaptionClip,
  MusicClip,
  Track,
  VideoClip,
} from "../../types/timeline.types";
import type { CaptionPresetRecord } from "./captions/preset.repository";
import { getFileUrl, uploadFile } from "../../services/storage/r2";
import { debugLog } from "../../utils/debug/debug";
import { buildFfmpegAtempoChain } from "./timeline/composition";
import { parseStoredEditorTracks } from "./validate-stored-tracks";

export type ExportJobDbDeps = {
  updateExportJob: (
    jobId: string,
    patch: {
      status?: string;
      progress?: number;
      error?: string | null;
      outputAssetId?: string | null;
    },
  ) => Promise<void>;
};

function isRenderableMediaClip(
  clip: Track["clips"][number],
): clip is VideoClip | AudioClip | MusicClip {
  return (
    clip.type === "video" || clip.type === "audio" || clip.type === "music"
  );
}

function escapeSubtitlesFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function getClipPlaybackSpeed(clip: { speed?: number }): number {
  return clip.speed && Number.isFinite(clip.speed) && clip.speed > 0
    ? clip.speed
    : 1;
}

function getClipSourceDurationSeconds(clip: {
  durationMs: number;
  speed?: number;
}): number {
  const durationMs = Number(clip.durationMs);
  const safeDurationMs =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  return (safeDurationMs / 1000) * getClipPlaybackSpeed(clip);
}

function toNonNegativeFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
}

async function probeHasAudioStream(filePath: string): Promise<boolean> {
  const timeoutMs = 10_000;
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const exitedOrTimedOut = await Promise.race([
    proc.exited.then(() => "exited" as const),
    new Promise<"timeout">((resolve) => {
      timeoutId = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          // Ignore kill failures; process may already be gone.
        }
        resolve("timeout");
      }, timeoutMs);
    }),
  ]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  if (exitedOrTimedOut === "timeout") {
    debugLog.warn("ffprobe timed out while probing audio stream", {
      service: "export-job",
      operation: "probeHasAudioStream",
      filePath,
      timeoutMs,
    });
    return false;
  }

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    debugLog.warn("ffprobe exited non-zero while probing audio stream", {
      service: "export-job",
      operation: "probeHasAudioStream",
      filePath,
      exitCode: proc.exitCode,
      stderrTail: stderr.slice(-300),
    });
    return false;
  }

  const stdout = await new Response(proc.stdout).text();
  return stdout.trim().length > 0;
}

async function setJobProgress(
  deps: ExportJobDbDeps,
  jobId: string,
  progress: number,
  status = "rendering",
) {
  await deps.updateExportJob(jobId, { progress, status });
}

/**
 * FFmpeg export pipeline — timeline semantics (trim, per-clip speed via setpts,
 * transitions) should stay aligned with the SPA preview module
 * `frontend/src/features/editor/utils/editor-composition.ts` and preview hooks.
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
  deps: ExportJobDbDeps & {
    findManyAssetsByIdsForUser: (
      userId: string,
      ids: string[],
    ) => Promise<Array<{ id: string; r2Key: string | null; type: string }>>;
    findCaptionDocByIdForUser: (
      userId: string,
      captionDocId: string,
    ) => Promise<{ id: string; tokens: Token[] } | null>;
    getCaptionPreset: (presetId: string) => Promise<CaptionPresetRecord | null>;
    insertAssembledVideoAsset: (row: NewAssetRow) => Promise<{ id: string }>;
  },
) {
  const tmpFiles: string[] = [];

  try {
    await deps.updateExportJob(jobId, { status: "rendering", progress: 5 });

    const tracks = parseStoredEditorTracks(project.tracks) as Track[];
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
      .filter(isRenderableMediaClip)
      .map((c) => c.assetId)
      .filter((id): id is string => !!id);

    let assetsMap: Record<string, { r2Key: string; type: string }> = {};
    if (assetIds.length > 0) {
      const assetRows = await deps.findManyAssetsByIdsForUser(userId, assetIds);
      assetsMap = Object.fromEntries(
        assetRows
          .filter((a) => a.r2Key)
          .map((a) => [a.id, { r2Key: a.r2Key!, type: a.type }]),
      );
    }

    await setJobProgress(deps, jobId, 20);

    const videoTracks = tracks.filter((t) => t.type === "video");
    const audioTrack = tracks.find((t) => t.type === "audio" && !t.muted);
    const musicTrack = tracks.find((t) => t.type === "music" && !t.muted);
    const textTrack = tracks.find((t) => t.type === "text");

    const videoClipsWithTrack = videoTracks.flatMap((t, trackIndex) =>
      t.clips
        .filter((clip): clip is VideoClip => clip.type === "video")
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
    const audioClips = (audioTrack?.clips ?? [])
      .filter((clip): clip is AudioClip => clip.type === "audio")
      .filter((c) => c.assetId && assetsMap[c.assetId]);
    const musicClips = (musicTrack?.clips ?? [])
      .filter((clip): clip is MusicClip => clip.type === "music")
      .filter((c) => c.assetId && assetsMap[c.assetId]);
    const captionClips = (textTrack?.clips ?? []).filter(
      (clip): clip is CaptionClip => clip.type === "caption",
    );

    if (videoClips.length === 0) {
      await deps.updateExportJob(jobId, {
        status: "failed",
        error: "No video clips on timeline",
      });
      return;
    }

    if (captionClips.length > 0) {
      for (const clip of captionClips) {
        const doc = await deps.findCaptionDocByIdForUser(
          userId,
          clip.captionDocId,
        );
        if (!doc) {
          throw new Error(
            `Caption doc "${clip.captionDocId}" was not found for clip "${clip.id}"`,
          );
        }

        const presetRecord = await deps.getCaptionPreset(clip.stylePresetId);
        if (!presetRecord) {
          throw new Error(
            `Caption preset "${clip.stylePresetId}" was not found for clip "${clip.id}"`,
          );
        }
      }
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
    const videoInputHasAudio: boolean[] = [];

    for (const clip of videoClips) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp4";
      const path = await downloadToTmp(asset.r2Key, ext);
      ffmpegInputs.push("-i", path);
      videoInputHasAudio.push(await probeHasAudioStream(path));
    }

    await setJobProgress(deps, jobId, 40);

    for (const clip of [...audioClips, ...musicClips]) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp3";
      const path = await downloadToTmp(asset.r2Key, ext);
      ffmpegInputs.push("-i", path);
    }

    const filterParts: string[] = [];
    const videoInputCount = videoClips.length;

    videoClips.forEach((clip, i) => {
      const trimStart = toNonNegativeFiniteNumber(clip.trimStartMs) / 1000;
      const sourceDurationSec = getClipSourceDurationSeconds(clip);
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
        `[${i}:v]trim=start=${trimStart}:duration=${sourceDurationSec},` +
          `${pts}scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
          `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black,${colorStr}setpts=PTS-STARTPTS[v${i}]`,
      );
    });

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

    if (captionClips.length > 0) {
      const styles = new Map<string, CaptionPresetRecord>();
      const events = [];

      for (const clip of captionClips) {
        const doc = await deps.findCaptionDocByIdForUser(
          userId,
          clip.captionDocId,
        );
        const presetRecord = await deps.getCaptionPreset(clip.stylePresetId);
        if (!doc || !presetRecord) {
          throw new Error(
            "Caption validation unexpectedly failed during export rendering",
          );
        }

        const slicedTokens = sliceTokensToRange(
          doc.tokens,
          clip.sourceStartMs,
          clip.sourceEndMs,
        );
        if (slicedTokens.length === 0) continue;

        const resolvedPreset = applyOverrides(
          presetRecord,
          clip.styleOverrides ?? {},
        );
        const styleName = deriveAssStyleName(resolvedPreset);
        const pages = buildPages(
          slicedTokens,
          clip.groupingMs || resolvedPreset.groupingMs,
        );
        if (pages.length === 0) continue;

        styles.set(styleName, {
          ...resolvedPreset,
          createdAt: presetRecord.createdAt,
          updatedAt: presetRecord.updatedAt,
        });
        events.push(
          ...generateASS(
            pages,
            resolvedPreset,
            { width: outW, height: outH },
            clip.startMs,
            styleName,
          ),
        );
      }

      if (events.length > 0) {
        const assFilePath = join(tmpdir(), `export-${jobId}-captions.ass`);
        writeFileSync(
          assFilePath,
          serializeASS(
            events,
            [...styles.entries()].map(([styleName, preset]) => ({
              styleName,
              preset,
            })),
            { width: outW, height: outH },
          ),
        );
        tmpFiles.push(assFilePath);

        const subtitleLabel = "vcaptions";
        filterParts.push(
          `[${latestVideoLabel}]subtitles='${escapeSubtitlesFilterPath(
            assFilePath,
          )}'[${subtitleLabel}]`,
        );
        latestVideoLabel = subtitleLabel;
      }
    }

    type ExportAudioInput = {
      clip: AudioClip | MusicClip | VideoClip;
      inputIdx: number;
      trackMuted: boolean;
    };

    const videoAudioInputs: ExportAudioInput[] = videoClipsWithTrack.flatMap(
      ({ clip, trackIndex }, inputIdx) => {
        if (
          videoTracks[trackIndex]?.muted ||
          !clip.assetId ||
          !videoInputHasAudio[inputIdx]
        ) {
          return [];
        }
        return [
          {
            clip,
            inputIdx,
            trackMuted: !!videoTracks[trackIndex]?.muted,
          },
        ];
      },
    );

    const audioInputs: ExportAudioInput[] = [
      ...videoAudioInputs,
      ...audioClips.map((clip, i) => ({
        clip,
        inputIdx: videoInputCount + i,
        trackMuted: !!audioTrack?.muted,
      })),
      ...musicClips.map((clip, i) => ({
        clip,
        inputIdx: videoInputCount + audioClips.length + i,
        trackMuted: !!musicTrack?.muted,
      })),
    ];
    let finalAudioLabel = "";
    if (audioInputs.length > 0) {
      audioInputs.forEach(({ clip, inputIdx, trackMuted }, i) => {
        const vol = (trackMuted || clip.muted ? 0 : (clip.volume ?? 1)).toFixed(
          2,
        );
        const trimStart = toNonNegativeFiniteNumber(clip.trimStartMs) / 1000;
        const durSec = getClipSourceDurationSeconds(clip);
        const atempo = buildFfmpegAtempoChain(getClipPlaybackSpeed(clip));
        const tempoPart = atempo ? `,${atempo}` : "";
        const delayMs = Math.round(toNonNegativeFiniteNumber(clip.startMs));
        filterParts.push(
          `[${inputIdx}:a]atrim=start=${trimStart}:duration=${durSec},asetpts=PTS-STARTPTS${tempoPart},volume=${vol},adelay=${delayMs}|${delayMs}[a${i}]`,
        );
      });
      if (audioInputs.length > 1) {
        const amixInputs = audioInputs.map((_, i) => `[a${i}]`).join("");
        filterParts.push(
          `${amixInputs}amix=inputs=${audioInputs.length}:normalize=0[amix]`,
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

    await setJobProgress(deps, jobId, 55);

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

    await setJobProgress(deps, jobId, 85);

    const outBuffer = Buffer.from(await Bun.file(tmpOut).arrayBuffer());
    const r2Key = `exports/${userId}/${project.id}/${jobId}.mp4`;
    const r2Url = await uploadFile(outBuffer, r2Key, "video/mp4");

    const outputAsset = await deps.insertAssembledVideoAsset({
      userId,
      type: "assembled_video",
      source: "export",
      r2Key,
      r2Url,
      sizeBytes: outBuffer.length,
      metadata: { editProjectId: project.id, jobId, resolution, fps },
    });

    await deps.updateExportJob(jobId, {
      status: "done",
      progress: 100,
      outputAssetId: outputAsset.id,
    });

    debugLog.info("Export job completed", {
      service: "export-job",
      operation: "runExportJob",
      jobId,
      r2Key,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await deps
      .updateExportJob(jobId, {
        status: "failed",
        error: message.slice(0, 500),
      })
      .catch(() => {});

    debugLog.error("Export job failed", {
      service: "export-job",
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
