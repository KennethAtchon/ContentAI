/**
 * ClipDecodeWorker — runs in a Worker thread.
 *
 * Owns a VideoDecoder for exactly one clip.
 * Demuxes the asset with mp4box.js, maintains a keyframe index for seeking,
 * and posts decoded frames back to the main thread.
 *
 * Message protocol (main → worker):
 *   { type: 'LOAD', assetUrl: string, clipId: string }
 *   { type: 'SEEK', targetMs: number }
 *   { type: 'PLAY' }
 *   { type: 'PAUSE' }
 *   { type: 'DESTROY' }
 *
 * Message protocol (worker → main):
 *   { type: 'READY', clipId: string }
 *   { type: 'FRAME', frame: VideoFrame, timestampUs: number, clipId: string }
 *   { type: 'SEEK_DONE', clipId: string }
 *   { type: 'SEEK_FAILED', message: string, clipId: string }
 *   { type: 'ERROR', message: string, clipId: string }
 */

import { createFile } from "mp4box";
import type { Movie, Sample, Track } from "mp4box";
import {
  MAX_DECODE_FETCH_BYTES,
  MAX_SEEK_DECODE_SAMPLES,
  assertSafeVideoTrack,
  assertSampleBudget,
} from "./decode-guard";

// mp4box v2.3 exposes a single `Track` type for both audio and video.
// Audio tracks have `track.audio` populated; video tracks have `track.video`.

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyframeEntry {
  /** Decode timestamp in microseconds (as stored in the container). */
  dts: number;
  /** Byte offset in the file. */
  offset: number;
  /** Sample index (0-based) into the video-only sample list. */
  sampleIndex: number;
}

interface ClipMeta {
  assetUrl: string;
  clipId: string;
}

// Bun's lib doesn't include DedicatedWorkerGlobalScope. Define the minimal
// surface we need so all postMessage calls use the browser Transferable signature.
interface WorkerCtx extends EventTarget {
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown, options?: StructuredSerializeOptions): void;
  close(): void;
  onmessage: ((ev: MessageEvent) => unknown) | null;
}
const ctx = self as unknown as WorkerCtx;

// ─── Worker state ─────────────────────────────────────────────────────────────

let clipMeta: ClipMeta | null = null;
let videoDecoder: VideoDecoder | null = null;
let videoDecoderConfig: VideoDecoderConfig | null = null;
let keyframeIndex: KeyframeEntry[] = [];
let videoSamples: Sample[] = [];
let videoTrackId = -1;
let isPlaying = false;
let playheadSampleIndex = 0;
let loadAbortController: AbortController | null = null;
let isDestroyed = false;
let feedTimer: ReturnType<typeof setTimeout> | null = null;
let seekOutputThresholdUs: number | null = null;
let didEmitFrameForActiveSeek = false;
let activeSeekToken: number | null = null;
let bufferedFramesAfterSeek: VideoFrame[] = [];

// ─── VideoDecoder helpers ──────────────────────────────────────────────────────

/**
 * Builds a `VideoDecoder` for this clip: stores baseline `VideoDecoderConfig`,
 * configures hardware decode, and wires `output` to **transfer** each
 * `VideoFrame` to the main thread (`FRAME` message). Errors become `ERROR`
 * posts. Codec `description` is left unset here; see `reconfigureVideoDecoder`.
 */
function createVideoDecoder(videoTrack: Track): VideoDecoder {
  const config: VideoDecoderConfig = {
    codec: videoTrack.codec,
    codedWidth: videoTrack.video?.width ?? 0,
    codedHeight: videoTrack.video?.height ?? 0,
    hardwareAcceleration: "prefer-hardware",
    // description is intentionally omitted here — derived from the first
    // sample after demux completes. See getVideoDescription() and the note
    // in 02-phase-1-clip-decode-worker.md § Known edge cases.
  };
  videoDecoderConfig = config;

  const decoder = new VideoDecoder({
    output(frame) {
      if (!clipMeta) {
        frame.close();
        return;
      }
      if (seekOutputThresholdUs !== null) {
        if (frame.timestamp < seekOutputThresholdUs) {
          frame.close();
          return;
        }
        if (!didEmitFrameForActiveSeek) {
          didEmitFrameForActiveSeek = true;
          postFrame(frame, activeSeekToken);
          return;
        }
        // Keep any future frames decoded during seek so playback can resume
        // without dropping frames that were needed to surface the target frame.
        bufferedFramesAfterSeek.push(frame);
        return;
      }
      postFrame(frame);
    },
    error(e) {
      ctx.postMessage({
        type: "ERROR",
        message: String(e),
        clipId: clipMeta?.clipId,
      });
    },
  });

  decoder.configure(config);
  return decoder;
}

function postFrame(frame: VideoFrame, seekToken?: number | null): void {
  if (!clipMeta) {
    frame.close();
    return;
  }
  ctx.postMessage(
    {
      type: "FRAME",
      frame,
      timestampUs: frame.timestamp,
      clipId: clipMeta.clipId,
      ...(seekToken !== undefined ? { seekToken } : {}),
    },
    // Transfer the frame — zero-copy. The main thread MUST call frame.close() after use.
    [frame as unknown as Transferable]
  );
}

function clearBufferedFrames(): void {
  for (const frame of bufferedFramesAfterSeek) {
    frame.close();
  }
  bufferedFramesAfterSeek = [];
}

function drainBufferedFrames(): void {
  if (bufferedFramesAfterSeek.length === 0) return;
  const frames = bufferedFramesAfterSeek;
  bufferedFramesAfterSeek = [];
  for (const frame of frames) {
    postFrame(frame);
  }
}

function closeVideoDecoder(): void {
  if (!videoDecoder) return;
  try {
    videoDecoder.close();
  } catch {
    // Ignore close failures during teardown/reload.
  }
  videoDecoder = null;
}

/**
 * After `VideoDecoder.reset()`, re-`configure` with the same dimensions/codec
 * plus optional `description` from `getVideoDescription()` (Phase 2: avcC/hvcC
 * bytes). Today `getVideoDescription` is a stub, so this mostly re-applies the
 * baseline config so decode can resume cleanly post-seek.
 */
function reconfigureVideoDecoder(decoder: VideoDecoder): void {
  if (!videoDecoderConfig) return;
  const description = getVideoDescription();
  decoder.configure(
    description ? { ...videoDecoderConfig, description } : videoDecoderConfig
  );
}

/**
 * Intended to return codec init bytes (avcC/hvcC) for `VideoDecoder` config.
 * mp4box exposes structured `sample.description` boxes, not a ready `Uint8Array`;
 * walking that tree is Phase 2. **Now:** always `undefined` — many H.264 assets
 * still decode from the codec string alone.
 */
function getVideoDescription(): Uint8Array | undefined {
  // TODO Phase 2: walk sample.description box tree to extract avcC/hvcC raw bytes.
  return undefined;
}

// ─── Demux + keyframe index ────────────────────────────────────────────────────

/**
 * Fetches the MP4, feeds it into mp4box, and fills module state for manual decode.
 *
 * **Order:** `fetch` → `appendBuffer`/`flush` → parse drives `onReady` (mp4box
 * `Movie` summary: tracks, codecs) → `setExtractionOptions` + `start()` →
 * `onSamples` batches append video samples and sync-sample rows to `keyframeIndex`.
 * The promise resolves after that first buffer is appended; Phase 1 assumes one
 * full file so `onReady` has already run and track[0] video/audio are enough.
 *
 * **Tracks:** Only `videoTracks[0]` and `audioTracks[0]`; extras are ignored.
 * **Audio:** The worker does not decode muxed audio yet; preview audio still
 * comes from the main-thread media element path.
 */
async function loadAsset(url: string): Promise<Track> {
  return new Promise((resolve, reject) => {
    const mp4boxFile = createFile();
    let foundVideoTrack: Track | null = null;
    let fileOffset = 0;
    let settled = false;

    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const resolveOnce = (videoTrack: Track) => {
      if (settled) return;
      settled = true;
      resolve(videoTrack);
    };

    mp4boxFile.onError = rejectOnce;

    mp4boxFile.onReady = (info: Movie) => {
      foundVideoTrack = info.videoTracks[0] ?? null;

      if (!foundVideoTrack) {
        rejectOnce(new Error("No video track found in asset"));
        return;
      }

      assertSafeVideoTrack(foundVideoTrack);

      videoTrackId = foundVideoTrack.id;
      mp4boxFile.setExtractionOptions(videoTrackId, null, {
        nbSamples: Infinity,
      });
      mp4boxFile.start();
    };

    mp4boxFile.onSamples = (
      trackId: number,
      _user: unknown,
      samples: Sample[]
    ) => {
      if (trackId !== videoTrackId) return;
      try {
        assertSampleBudget(videoSamples.length, samples);
      } catch (error) {
        rejectOnce(error);
        return;
      }

      const baseIndex = videoSamples.length;
      videoSamples.push(...samples);

      // Build keyframe index from I-frames.
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].is_sync) {
          keyframeIndex.push({
            dts: samples[i].dts,
            offset: samples[i].offset,
            sampleIndex: baseIndex + i,
          });
        }
      }
    };

    // Fetch the full asset. For large files this should be range-request based;
    // for Phase 1 a full fetch is acceptable as the asset is already in the browser cache.
    loadAbortController = new AbortController();
    fetch(url, { signal: loadAbortController.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Asset fetch failed: ${res.status}`);
        const contentLength = Number(res.headers.get("content-length") ?? "0");
        if (contentLength > MAX_DECODE_FETCH_BYTES) {
          throw new Error(
            `Asset exceeds decode size limit (${Math.floor(MAX_DECODE_FETCH_BYTES / (1024 * 1024))}MB)`
          );
        }
        if (!res.body) {
          return res.arrayBuffer().then((buffer) => {
            if (buffer.byteLength > MAX_DECODE_FETCH_BYTES) {
              throw new Error(
                `Asset exceeds decode size limit (${Math.floor(MAX_DECODE_FETCH_BYTES / (1024 * 1024))}MB)`
              );
            }
            return buffer;
          });
        }

        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;

        const pump = async (): Promise<ArrayBuffer> => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            total += value.byteLength;
            if (total > MAX_DECODE_FETCH_BYTES) {
              loadAbortController?.abort();
              throw new Error(
                `Asset exceeds decode size limit (${Math.floor(MAX_DECODE_FETCH_BYTES / (1024 * 1024))}MB)`
              );
            }
            chunks.push(value);
          }

          const combined = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.byteLength;
          }
          return combined.buffer;
        };

        return pump();
      })
      .then((buffer) => {
        // mp4box expects an ArrayBuffer with a fileStart property.
        const ab = buffer as ArrayBuffer & { fileStart: number };
        ab.fileStart = fileOffset;
        fileOffset += buffer.byteLength;
        mp4boxFile.appendBuffer(ab);
        mp4boxFile.flush();
        loadAbortController = null;

        if (foundVideoTrack) {
          resolveOnce(foundVideoTrack);
        } else {
          rejectOnce(new Error("mp4box did not produce track info"));
        }
      })
      .catch((error) => {
        loadAbortController = null;
        if (isAbortError(error)) {
          if (isDestroyed) return;
        }
        rejectOnce(error);
      });
  });
}

// ─── Seek logic ────────────────────────────────────────────────────────────────

function getSamplePresentationTimestamp(sample: Sample): number {
  return (sample as Sample & { cts?: number }).cts ?? sample.dts;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/**
 * Seeks in **source** time (`targetMs`): picks the last keyframe ≤ target from
 * `keyframeIndex`, `reset`s the decoder, decodes from that GOP through the
 * first sample with presentation time ≥ target (so references resolve), `flush`, then
 * `SEEK_DONE`. Updates `playheadSampleIndex` for subsequent `feedNextChunk`.
 */
async function seekTo(
  targetMs: number,
  seekToken: number | null
): Promise<void> {
  if (!videoDecoder || !clipMeta) return;
  if (videoSamples.length === 0) {
    throw new Error("No decodable video samples available for seek");
  }

  const targetUs = targetMs * 1000;

  // Find the last keyframe at or before targetUs.
  let gopEntry = keyframeIndex[0];
  if (!gopEntry) {
    throw new Error("No keyframes available for seek");
  }
  for (const entry of keyframeIndex) {
    if (entry.dts <= targetUs) gopEntry = entry;
    else break;
  }

  // Reset and reconfigure to flush internal decoder state.
  clearBufferedFrames();
  videoDecoder.reset();
  reconfigureVideoDecoder(videoDecoder);
  seekOutputThresholdUs = targetUs;
  didEmitFrameForActiveSeek = false;
  activeSeekToken = seekToken;

  // Default to EOF if the target lies beyond the last decodable frame.
  playheadSampleIndex = videoSamples.length;

  // Feed samples from GOP keyframe up to (and including) the target frame.
  let decodedSamples = 0;
  let crossedTarget = false;
  for (let i = gopEntry.sampleIndex; i < videoSamples.length; i++) {
    const sample = videoSamples[i];
    if (!sample.data) continue;
    decodedSamples++;
    if (decodedSamples > MAX_SEEK_DECODE_SAMPLES) {
      throw new Error(
        `Seek decode budget exceeded (${MAX_SEEK_DECODE_SAMPLES} samples)`
      );
    }
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? "key" : "delta",
      timestamp: getSamplePresentationTimestamp(sample),
      duration: sample.duration,
      data: sample.data,
    });
    videoDecoder.decode(chunk);
    if (getSamplePresentationTimestamp(sample) >= targetUs) {
      crossedTarget = true;
    }
    if (crossedTarget) {
      await videoDecoder.flush();
      if (didEmitFrameForActiveSeek) {
        playheadSampleIndex = i + 1;
        break;
      }
    }
  }

  try {
    if (!didEmitFrameForActiveSeek && crossedTarget) {
      throw new Error(`Failed to decode a frame for seek target ${targetMs}ms`);
    }
  } finally {
    seekOutputThresholdUs = null;
    didEmitFrameForActiveSeek = false;
    activeSeekToken = null;
  }
}

// ─── Continuous decode loop ────────────────────────────────────────────────────

/**
 * Playback pump while `isPlaying`: one sample → `EncodedVideoChunk` →
 * `decode`, then reschedules itself (`setTimeout(0)`). If `decodeQueueSize` > 8,
 * backs off 16ms to avoid flooding the decoder. Stops at EOF (clears playing).
 * Relies on `playheadSampleIndex` already aligned (e.g. after `seekTo`).
 */
function feedNextChunk(): void {
  feedTimer = null;
  if (!isPlaying || !videoDecoder) return;
  if (videoDecoder.decodeQueueSize > 8) {
    // Back-pressure: decoder queue is full. Retry after a short delay.
    feedTimer = setTimeout(feedNextChunk, 16);
    return;
  }

  if (playheadSampleIndex >= videoSamples.length) {
    isPlaying = false;
    return;
  }

  const sample = videoSamples[playheadSampleIndex++];
  if (sample.data) {
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? "key" : "delta",
      timestamp: getSamplePresentationTimestamp(sample),
      duration: sample.duration,
      data: sample.data,
    });
    videoDecoder.decode(chunk);
  }
  feedTimer = setTimeout(feedNextChunk, 0);
}

function ensureFeedLoop(): void {
  if (feedTimer !== null) return;
  drainBufferedFrames();
  feedTimer = setTimeout(feedNextChunk, 0);
}

function stopFeedLoop(): void {
  if (feedTimer === null) return;
  clearTimeout(feedTimer);
  feedTimer = null;
}

// ─── Message handler ───────────────────────────────────────────────────────────

/**
 * Main-thread protocol entry: `LOAD` demuxes + builds decoders and sends `READY`
 * or `ERROR`; `SEEK` runs GOP seek; `PLAY`/`PAUSE` toggle `isPlaying` and the
 * feed loop; `DESTROY` tears down decoders, clears buffers, `close()`s the worker.
 */
ctx.onmessage = async (event: MessageEvent) => {
  const msg = event.data as
    | { type: "LOAD"; assetUrl: string; clipId: string }
    | { type: "SEEK"; targetMs: number; seekToken?: number | null }
    | { type: "PLAY" }
    | { type: "PAUSE" }
    | { type: "DESTROY" };

  switch (msg.type) {
    case "LOAD": {
      loadAbortController?.abort();
      isDestroyed = false;
      stopFeedLoop();
      clearBufferedFrames();
      closeVideoDecoder();
      clipMeta = { assetUrl: msg.assetUrl, clipId: msg.clipId };
      seekOutputThresholdUs = null;
      didEmitFrameForActiveSeek = false;
      activeSeekToken = null;
      keyframeIndex = [];
      videoSamples = [];
      videoTrackId = -1;
      playheadSampleIndex = 0;

      try {
        const videoTrack = await loadAsset(msg.assetUrl);
        if (isDestroyed) break;
        videoDecoder = createVideoDecoder(videoTrack);
        ctx.postMessage({ type: "READY", clipId: msg.clipId });
      } catch (e) {
        if (isDestroyed || isAbortError(e)) {
          break;
        }
        ctx.postMessage({
          type: "ERROR",
          message: String(e),
          clipId: msg.clipId,
        });
      }
      break;
    }

    case "SEEK": {
      isPlaying = false;
      stopFeedLoop();
      try {
        const seekToken = "seekToken" in msg ? (msg.seekToken ?? null) : null;
        await seekTo(msg.targetMs, seekToken);
        if (clipMeta?.clipId) {
          ctx.postMessage({
            type: "SEEK_DONE",
            clipId: clipMeta.clipId,
            seekToken,
          });
        }
      } catch (e) {
        if (isDestroyed || isAbortError(e)) {
          break;
        }
        const seekToken = "seekToken" in msg ? (msg.seekToken ?? null) : null;
        ctx.postMessage({
          type: "SEEK_FAILED",
          message: String(e),
          clipId: clipMeta?.clipId,
          seekToken,
        });
      }
      break;
    }

    case "PLAY": {
      isPlaying = true;
      ensureFeedLoop();
      break;
    }

    case "PAUSE": {
      isPlaying = false;
      stopFeedLoop();
      // Do NOT flush — we want to resume from the same position.
      break;
    }

    case "DESTROY": {
      isDestroyed = true;
      isPlaying = false;
      stopFeedLoop();
      loadAbortController?.abort();
      loadAbortController = null;
      clearBufferedFrames();
      seekOutputThresholdUs = null;
      didEmitFrameForActiveSeek = false;
      activeSeekToken = null;
      closeVideoDecoder();
      videoSamples = [];
      keyframeIndex = [];
      ctx.close();
      break;
    }
  }
};
