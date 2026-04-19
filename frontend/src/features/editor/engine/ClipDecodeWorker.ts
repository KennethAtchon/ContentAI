/**
 * ClipDecodeWorker — runs in a Worker thread.
 *
 * Owns a VideoDecoder for exactly one clip.
 * Demuxes the asset with mp4box.js, maintains a keyframe index for seeking,
 * and posts decoded frames back to the main thread.
 *
 * Message protocol (main → worker):
 *   { type: 'LOAD', assetUrl: string, clipId: string, metadata?: CachedDemuxMetadata }
 *   { type: 'SEEK', targetMs: number }
 *   { type: 'PLAY' }
 *   { type: 'PAUSE' }
 *   { type: 'DESTROY' }
 *
 * Message protocol (worker → main):
 *   { type: 'READY', clipId: string }
 *   { type: 'METADATA_READY', clipId: string, assetUrl: string, metadata: CachedDemuxMetadata }
 *   { type: 'FRAME', frame: VideoFrame, timestampUs: number, clipId: string }
 *   { type: 'SEEK_DONE', clipId: string }
 *   { type: 'SEEK_FAILED', message: string, clipId: string }
 *   { type: 'ERROR', message: string, clipId: string }
 */

import { createFile, MultiBufferStream } from "mp4box";
import type { Movie, Sample, Track, VisualSampleEntry } from "mp4box";
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

interface VideoTrackMetadata {
  id: number;
  timescale: number;
  codec: string;
  width: number;
  height: number;
}

interface DecodableVideoSample {
  dts: number;
  cts?: number;
  duration: number;
  is_sync: boolean;
  data?: Uint8Array;
}

export interface CachedDemuxMetadata {
  assetUrl: string;
  videoTrack: VideoTrackMetadata;
  keyframeIndex: KeyframeEntry[];
  videoSamples: DecodableVideoSample[];
  decoderDescription?: Uint8Array;
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
let videoSamples: DecodableVideoSample[] = [];
let videoTrackId = -1;
let videoTimescale = 1; // track timescale (e.g. 90000 for 90 kHz)
let cachedDecoderDescription: Uint8Array | undefined;
let isPlaying = false;
let playheadSampleIndex = 0;
let loadAbortController: AbortController | null = null;
let isDestroyed = false;
let feedTimer: ReturnType<typeof setTimeout> | null = null;
let seekOutputThresholdUs: number | null = null;
let didEmitFrameForActiveSeek = false;
let activeSeekToken: number | null = null;
let bufferedFramesAfterSeek: VideoFrame[] = [];
/**
 * True after configure/reset; cleared on first key-chunk decode.
 * Some browsers clear the decoder's reference-frame state after flush(),
 * requiring a new key frame at the start of every feedNextChunk run.
 * We track this so feedNextChunk can rewind to the GOP start if needed.
 */
let decoderNeedsKeyFrame = true;

// ─── VideoDecoder helpers ──────────────────────────────────────────────────────

/**
 * Builds a `VideoDecoder` for this clip: stores baseline `VideoDecoderConfig`,
 * configures hardware decode, and wires `output` to **transfer** each
 * `VideoFrame` to the main thread (`FRAME` message). Errors become `ERROR`
 * posts. Codec `description` is left unset here; see `reconfigureVideoDecoder`.
 */
function createVideoDecoder(videoTrack: VideoTrackMetadata): VideoDecoder {
  const config: VideoDecoderConfig = {
    codec: videoTrack.codec,
    codedWidth: videoTrack.width,
    codedHeight: videoTrack.height,
    hardwareAcceleration: "prefer-hardware",
    // description is intentionally omitted here — derived from the first
    // sample after demux completes. See getVideoDescription() and the note
    // in 02-phase-1-clip-decode-worker.md § Known edge cases.
  };
  videoDecoderConfig = config;

  // Apply codec description immediately if samples are already available
  // (true when called after loadAsset resolves). Reconfigures will also apply it.
  const description = getVideoDescription();
  const configWithDescription = description
    ? { ...config, description }
    : config;

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

  decoder.configure(configWithDescription);
  decoderNeedsKeyFrame = true;
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
  decoderNeedsKeyFrame = true;
}

/**
 * Extracts codec init bytes (avcC/hvcC) from the first sample's description box.
 * These bytes are required by WebCodecs VideoDecoder for H.264 and H.265 streams
 * contained in MP4 (AVCC/HVCC byte-stream format). Without them the decoder
 * throws "EncodingError: The given encoding is not supported".
 *
 * The box layout written by DataStream.write() is:
 *   [4 bytes size][4 bytes fourcc][N bytes DecoderConfigurationRecord]
 * We skip the 8-byte box header and return only the record bytes.
 */
function getVideoDescription(): Uint8Array | undefined {
  if (cachedDecoderDescription) return cachedDecoderDescription;
  if (videoSamples.length === 0) return undefined;
  const sample = videoSamples[0] as Sample | undefined;
  if (!sample?.description) return undefined;

  const entry = sample.description as VisualSampleEntry;
  const configBox = entry.avcC ?? entry.hvcC;
  if (!configBox) return undefined;

  try {
    // MultiBufferStream extends DataStream — use it because write() is typed to require it.
    const stream = new MultiBufferStream();
    configBox.write(stream);
    // stream.byteLength is the actual written length (may be less than buffer.byteLength).
    // Box layout: [4 bytes size][4 bytes fourcc][N bytes DecoderConfigurationRecord]
    const recordLength = stream.byteLength - 8;
    if (recordLength <= 0) return undefined;
    return new Uint8Array(stream.buffer as ArrayBuffer, 8, recordLength);
  } catch {
    return undefined;
  }
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
 * **Speed:** The worker always seeks in source-media time. Timeline speed math
 * is resolved on the main thread before targetMs reaches this worker.
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
      videoTimescale = foundVideoTrack.timescale ?? 1;
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

      // Build keyframe index from I-frames. Store dts in µs so seekTo can compare
      // directly against targetUs without a per-entry timescale conversion.
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].is_sync) {
          keyframeIndex.push({
            dts: Math.round((samples[i].dts * 1_000_000) / videoTimescale),
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

function applyCachedMetadata(metadata: CachedDemuxMetadata): VideoTrackMetadata {
  videoTrackId = metadata.videoTrack.id;
  videoTimescale = metadata.videoTrack.timescale;
  keyframeIndex = metadata.keyframeIndex;
  videoSamples = metadata.videoSamples;
  cachedDecoderDescription = metadata.decoderDescription;
  return metadata.videoTrack;
}

function buildCachedMetadata(
  assetUrl: string,
  videoTrack: Track
): CachedDemuxMetadata {
  const width = videoTrack.video?.width ?? 0;
  const height = videoTrack.video?.height ?? 0;
  return {
    assetUrl,
    videoTrack: {
      id: videoTrack.id,
      timescale: videoTrack.timescale ?? 1,
      codec: videoTrack.codec,
      width,
      height,
    },
    keyframeIndex: keyframeIndex.map((entry) => ({ ...entry })),
    videoSamples: videoSamples.map((sample) => ({
      dts: sample.dts,
      cts: sample.cts,
      duration: sample.duration,
      is_sync: sample.is_sync,
      data: sample.data,
    })),
    decoderDescription: getVideoDescription(),
  };
}

// ─── Seek logic ────────────────────────────────────────────────────────────────

/**
 * Returns the presentation timestamp of a sample in **microseconds**.
 * mp4box stores DTS/CTS in the track's native timescale units (e.g. 90000 for
 * 90 kHz). WebCodecs EncodedVideoChunk.timestamp and the compositor sourceTimeUs
 * are both in µs, so we convert here before any comparison or decode call.
 */
function getSampleTimestampUs(sample: DecodableVideoSample): number {
  const ticks = sample.cts ?? sample.dts;
  return Math.round((ticks * 1_000_000) / videoTimescale);
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
    const isKey = sample.is_sync;
    const chunk = new EncodedVideoChunk({
      type: isKey ? "key" : "delta",
      timestamp: getSampleTimestampUs(sample),
      duration: sample.duration,
      data: sample.data,
    });
    videoDecoder.decode(chunk);
    if (isKey) decoderNeedsKeyFrame = false;
    if (getSampleTimestampUs(sample) >= targetUs) {
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

  // Guard: if decoder needs a key frame (post-configure or post-flush on some
  // browsers) but the next sample is a delta, rewind playheadSampleIndex to the
  // start of the current GOP so we re-feed the keyframe first.
  if (decoderNeedsKeyFrame && !videoSamples[playheadSampleIndex]?.is_sync) {
    let gopStart = 0;
    for (const entry of keyframeIndex) {
      if (entry.sampleIndex <= playheadSampleIndex) gopStart = entry.sampleIndex;
      else break;
    }
    playheadSampleIndex = gopStart;
  }

  const sample = videoSamples[playheadSampleIndex++];
  if (sample.data) {
    const isKey = sample.is_sync;
    const chunk = new EncodedVideoChunk({
      type: isKey ? "key" : "delta",
      timestamp: getSampleTimestampUs(sample),
      duration: sample.duration,
      data: sample.data,
    });
    videoDecoder.decode(chunk);
    if (isKey) decoderNeedsKeyFrame = false;
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
    | {
        type: "LOAD";
        assetUrl: string;
        clipId: string;
        metadata?: CachedDemuxMetadata;
      }
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
      videoTimescale = 1;
      cachedDecoderDescription = undefined;
      playheadSampleIndex = 0;
      decoderNeedsKeyFrame = true;

      try {
        const videoTrack = msg.metadata
          ? applyCachedMetadata(msg.metadata)
          : await loadAsset(msg.assetUrl).then((loadedTrack) => {
              const metadata = buildCachedMetadata(msg.assetUrl, loadedTrack);
              ctx.postMessage({
                type: "METADATA_READY",
                clipId: msg.clipId,
                assetUrl: msg.assetUrl,
                metadata,
              });
              return metadata.videoTrack;
            });
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
      cachedDecoderDescription = undefined;
      ctx.close();
      break;
    }
  }
};
