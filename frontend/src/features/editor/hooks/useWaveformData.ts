import { useState, useEffect } from "react";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

/** Number of amplitude samples stored per asset. */
const PEAK_COUNT = 200;

const peakCache = new Map<string, Float32Array>();

const pendingDecodes = new Map<string, Promise<Float32Array>>();
const MAX_CONCURRENT_DECODES = 2;
let activeDecodeCount = 0;
const decodeQueue: Array<() => void> = [];
type AudioDecodeContext = Pick<BaseAudioContext, "decodeAudioData">;
let sharedDecodeContext: AudioDecodeContext | null = null;

function getSharedDecodeContext(): AudioDecodeContext {
  if (!sharedDecodeContext) {
    const OfflineAudioContextCtor =
      globalThis.OfflineAudioContext ??
      (
        globalThis as typeof globalThis & {
          webkitOfflineAudioContext?: typeof OfflineAudioContext;
        }
      ).webkitOfflineAudioContext;

    if (OfflineAudioContextCtor) {
      sharedDecodeContext = new OfflineAudioContextCtor(1, 1, 44_100);
    } else {
      sharedDecodeContext = new globalThis.AudioContext();
    }
  }
  return sharedDecodeContext;
}

async function withDecodeSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeDecodeCount >= MAX_CONCURRENT_DECODES) {
    await new Promise<void>((resolve) => decodeQueue.push(resolve));
  }

  activeDecodeCount += 1;
  try {
    return await task();
  } finally {
    activeDecodeCount -= 1;
    const next = decodeQueue.shift();
    if (next) next();
  }
}

async function decodePeaksFromArrayBuffer(
  arrayBuffer: ArrayBuffer
): Promise<Float32Array> {
  const decoded = await withDecodeSlot(() =>
    getSharedDecodeContext().decodeAudioData(arrayBuffer.slice(0))
  );

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
