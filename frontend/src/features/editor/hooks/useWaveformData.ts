import { useState, useEffect } from "react";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

/** Number of amplitude samples stored per asset. */
const PEAK_COUNT = 200;

type DecodedAudio = Awaited<
  ReturnType<InstanceType<typeof globalThis.AudioContext>["decodeAudioData"]>
>;

const peakCache = new Map<string, Float32Array>();

const pendingDecodes = new Map<string, Promise<Float32Array>>();

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
  peaks: Float32Array | null;
  loading: boolean;
}

export function useWaveformData(
  assetId: string | undefined,
  audioUrl: string | undefined
): UseWaveformDataResult {
  const { authenticatedFetch } = useAuthenticatedFetch();

  const [peaks, setPeaks] = useState<Float32Array | null>(() =>
    assetId ? (peakCache.get(assetId) ?? null) : null
  );
  const [loading, setLoading] = useState<boolean>(
    () => !!assetId && !peakCache.has(assetId) && !!audioUrl
  );

  useEffect(() => {
    if (!assetId || !audioUrl) return;

    if (peakCache.has(assetId)) {
      const cached = peakCache.get(assetId)!;
      setPeaks(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

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
