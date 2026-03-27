import { useState, useEffect } from "react";

/** Number of amplitude samples stored per asset. */
const PEAK_COUNT = 200;

/**
 * Module-level cache keyed by assetId (stable across signed URL rotations).
 * Stores RMS-normalized peak arrays decoded from audio/video files.
 */
const peakCache = new Map<string, Float32Array>();

/**
 * In-flight promise cache: prevents duplicate fetches when multiple clips for
 * the same asset mount simultaneously (e.g., a clip that spans two tracks).
 * Keyed by assetId.
 */
const pendingDecodes = new Map<string, Promise<Float32Array>>();

/**
 * Fetches an audio/video file by URL, decodes it with the Web Audio API,
 * and returns an RMS-normalized Float32Array of PEAK_COUNT amplitude samples.
 *
 * Works for:
 *  - Audio files: .mp3, .wav, .aac, .ogg (voiceover, music)
 *  - Video files: .mp4, .webm (shot clips — extracts the embedded audio track)
 *
 * Throws on network error, CORS error, or unsupported codec.
 */
async function decodePeaks(audioUrl: string): Promise<Float32Array> {
  const response = await fetch(audioUrl, {
    credentials: "omit", // R2 signed URLs don't need credentials
    cache: "force-cache", // reuse cached response if browser has it
  });

  if (!response.ok) {
    throw new Error(`waveform fetch failed: HTTP ${response.status} — ${audioUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // AudioContext is used only for decoding — not for playback.
  // Close immediately after decode to release resources.
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    // Non-blocking — do not await, fire and forget.
    ctx.close().catch(() => {});
  }

  // Use channel 0 (left/mono). Stereo files are fine — we only need one channel
  // to compute amplitude. The RMS across both channels would be more accurate,
  // but the visual difference is imperceptible for timeline thumbnails.
  const channelData = decoded.getChannelData(0);
  const totalSamples = channelData.length;
  const blockSize = Math.max(1, Math.floor(totalSamples / PEAK_COUNT));

  const peaks = new Float32Array(PEAK_COUNT);
  for (let i = 0; i < PEAK_COUNT; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += channelData[j] * channelData[j]; // squared for RMS
    }
    peaks[i] = Math.sqrt(sum / (end - start));
  }

  // Normalize to [0, 1]. If the file is entirely silent, leave as zeros.
  let max = 0;
  for (let i = 0; i < PEAK_COUNT; i++) {
    if (peaks[i] > max) max = peaks[i];
  }
  if (max > 0) {
    for (let i = 0; i < PEAK_COUNT; i++) peaks[i] /= max;
  }

  return peaks;
}

export interface UseWaveformDataResult {
  /** Normalized amplitude array [0,1] with PEAK_COUNT entries. Null while loading or on error. */
  peaks: Float32Array | null;
  /** True while the audio file is being fetched and decoded. */
  loading: boolean;
}

/**
 * Decodes waveform amplitude data for a single clip.
 *
 * - Cache hit (same assetId seen before): returns peaks synchronously on first render,
 *   loading=false. No network request.
 * - Cache miss: loading=true until decode completes, then peaks becomes non-null.
 * - Concurrent mounts with the same assetId share one in-flight promise.
 * - Component unmount cancels the state update but does not abort the fetch;
 *   the decode result is still stored in the cache for future mounts.
 *
 * @param assetId  Stable asset identifier (clip.assetId). Used as the cache key.
 * @param audioUrl Resolved URL to the audio/video file. Used only for fetching.
 */
export function useWaveformData(
  assetId: string | undefined,
  audioUrl: string | undefined
): UseWaveformDataResult {
  // Initialise from cache synchronously so clips that were decoded earlier in
  // this session render instantly without a loading flash.
  const [peaks, setPeaks] = useState<Float32Array | null>(() =>
    assetId ? (peakCache.get(assetId) ?? null) : null
  );
  const [loading, setLoading] = useState<boolean>(
    () => !!assetId && !peakCache.has(assetId) && !!audioUrl
  );

  useEffect(() => {
    if (!assetId || !audioUrl) return;

    // Synchronous cache hit — state is already correct from initializer.
    if (peakCache.has(assetId)) {
      const cached = peakCache.get(assetId)!;
      setPeaks(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Coalesce: if another mount is already decoding this asset, attach to its promise.
    let promise = pendingDecodes.get(assetId);
    if (!promise) {
      promise = decodePeaks(audioUrl)
        .then((result) => {
          peakCache.set(assetId, result);
          pendingDecodes.delete(assetId);
          return result;
        })
        .catch((err) => {
          pendingDecodes.delete(assetId);
          // Re-throw so the .then handler below does not set peaks.
          throw err;
        });
      pendingDecodes.set(assetId, promise);
    }

    promise
      .then((result) => {
        if (!cancelled) {
          setPeaks(result);
          setLoading(false);
        }
      })
      .catch(() => {
        // Decode failed (CORS, codec, network error).
        // Render nothing — clip still shows its label and duration.
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetId, audioUrl]);

  return { peaks, loading };
}
