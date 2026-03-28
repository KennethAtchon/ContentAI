import { useState, useEffect } from "react";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

/** Number of amplitude samples stored per asset. */
const PEAK_COUNT = 200;

type DecodedAudio = Awaited<
  ReturnType<InstanceType<typeof globalThis.AudioContext>["decodeAudioData"]>
>;

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
 * Decodes raw audio/video bytes with the Web Audio API and returns an
 * RMS-normalized Float32Array of PEAK_COUNT amplitude samples.
 */
async function decodePeaksFromArrayBuffer(
  arrayBuffer: ArrayBuffer
): Promise<Float32Array> {
  const ctx = new globalThis.AudioContext();
  let decoded: DecodedAudio;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }

  const channelData = decoded.getChannelData(0);
  const totalSamples = channelData.length;
  const blockSize = Math.max(1, Math.floor(totalSamples / PEAK_COUNT));

  const peaks = new Float32Array(PEAK_COUNT);
  for (let i = 0; i < PEAK_COUNT; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    peaks[i] = Math.sqrt(sum / (end - start));
  }

  let max = 0;
  for (let i = 0; i < PEAK_COUNT; i++) {
    if (peaks[i] > max) max = peaks[i];
  }
  if (max > 0) {
    for (let i = 0; i < PEAK_COUNT; i++) peaks[i] /= max;
  }

  return peaks;
}

type AuthFetch = (
  url: string,
  init?: RequestInit,
  timeout?: number
) => Promise<Response>;

/**
 * Prefer same-origin API stream (no R2 CORS). Falls back to signed URL fetch
 * when the asset is not owned by the user (e.g. some shared library rows).
 */
async function decodePeaksForAsset(
  assetId: string,
  signedUrl: string,
  authenticatedFetch: AuthFetch
): Promise<Float32Array> {
  try {
    const proxyRes = await authenticatedFetch(
      `/api/assets/${assetId}/media-for-decode`,
      { method: "GET" },
      0
    );
    if (proxyRes.ok) {
      return decodePeaksFromArrayBuffer(await proxyRes.arrayBuffer());
    }
  } catch {
    // Auth/network errors — try signed URL below.
  }

  // Signed R2 URL: must use cross-origin fetch (not authenticatedFetch). Works when bucket CORS allows the SPA origin.
  const response = await globalThis.fetch(signedUrl, {
    credentials: "omit",
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(
      `waveform fetch failed: HTTP ${response.status} — ${signedUrl}`
    );
  }

  return decodePeaksFromArrayBuffer(await response.arrayBuffer());
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
 * @param audioUrl Resolved URL to the audio/video file (fallback if API proxy misses).
 */
export function useWaveformData(
  assetId: string | undefined,
  audioUrl: string | undefined
): UseWaveformDataResult {
  const { authenticatedFetch } = useAuthenticatedFetch();

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
      promise = decodePeaksForAsset(assetId, audioUrl, authenticatedFetch)
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
  }, [assetId, audioUrl, authenticatedFetch]);

  return { peaks, loading };
}
