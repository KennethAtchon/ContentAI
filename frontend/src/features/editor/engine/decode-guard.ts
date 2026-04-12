import type { VideoClip } from "../types/editor";
import type { Sample, Track } from "mp4box";

export const MAX_ACTIVE_VIDEO_WORKERS = 4;
export const MAX_WORKERS_PER_ASSET_URL = 1;
export const MAX_DECODE_FETCH_BYTES = 80 * 1024 * 1024;
export const MAX_VIDEO_SAMPLES = 12_000;
export const MAX_VIDEO_DIMENSION = 4096;
export const MAX_SEEK_DECODE_SAMPLES = 240;
export const DECODE_FAILURE_COOLDOWN_MS = 10_000;

export function getClipDecodePriority(
  clip: Pick<VideoClip, "startMs" | "durationMs">,
  playheadMs: number,
): number {
  const clipEnd = clip.startMs + clip.durationMs;
  if (playheadMs < clip.startMs) return clip.startMs - playheadMs;
  if (playheadMs > clipEnd) return playheadMs - clipEnd;
  return 0;
}

export function assertSafeVideoTrack(track: Track): void {
  const width = track.video?.width ?? 0;
  const height = track.video?.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new Error("Video track has invalid dimensions");
  }
  if (width > MAX_VIDEO_DIMENSION || height > MAX_VIDEO_DIMENSION) {
    throw new Error(
      `Video dimensions exceed decode limit (${MAX_VIDEO_DIMENSION}px max)`,
    );
  }
}

export function assertSampleBudget(
  currentSamples: number,
  incomingSamples: Sample[],
): void {
  if (currentSamples + incomingSamples.length > MAX_VIDEO_SAMPLES) {
    throw new Error(`Video sample count exceeds decode limit (${MAX_VIDEO_SAMPLES})`);
  }
}
