# Phase 1: Clip Decode Worker

**Goal:** A Worker can receive an asset URL and a clip descriptor, demux the container with `mp4box.js`, and emit decoded `VideoFrame` objects at correct timestamps. GOP-aware seeking works (no corrupted frames). The worker is not yet wired to visible preview output.

**Architecture note:** Phase 1 is intentionally video-only. Even when a video asset contains muxed audio, that audio will be fetched and scheduled later by `AudioMixer` in Phase 3. This means the same asset may be fetched once by the decode worker for video and again by `AudioMixer` for audio. We accept that duplication so all preview audio behavior lives in one subsystem.

**Done criteria:**
- `ClipDecodeWorker.ts` handles `LOAD`, `SEEK`, `PLAY`, `PAUSE`, `DESTROY` messages
- `DecoderPool.ts` creates/destroys workers as clips enter and leave the active window
- Manual test: load a clip, call `SEEK` to 1500ms, receive a `VideoFrame` with timestamp ≈ 1500ms ± one frame duration
- `bun run type-check` passes

---

## Step 1 — Add `mp4box.js`

```bash
cd frontend
bun add mp4box
bun add -d @types/mp4box
```

Confirm the package is in `package.json` dependencies and the type declaration is in devDependencies.

---

## Step 2 — Create `ClipDecodeWorker.ts`

Create `frontend/src/features/editor/engine/ClipDecodeWorker.ts`:

```ts
/**
 * ClipDecodeWorker — runs in a Worker thread.
 *
 * Owns a VideoDecoder for exactly one clip.
 * Demuxes the asset with mp4box.js, maintains a keyframe index for seeking,
 * and posts decoded frames back to the main thread.
 *
 * Message protocol (main → worker):
 *   { type: 'LOAD', assetUrl: string, clipId: string, trimStartMs: number, speed: number }
 *   { type: 'SEEK', targetMs: number }
 *   { type: 'PLAY' }
 *   { type: 'PAUSE' }
 *   { type: 'DESTROY' }
 *
 * Message protocol (worker → main):
 *   { type: 'READY' }
 *   { type: 'FRAME', frame: VideoFrame, timestampUs: number, clipId: string }
 *   { type: 'SEEK_DONE', clipId: string }
 *   { type: 'ERROR', message: string, clipId: string }
 */

import MP4Box from "mp4box";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyframeEntry {
  /** Decode timestamp in microseconds (as stored in the container). */
  dts: number;
  /** Byte offset in the file. */
  offset: number;
  /** Sample index (0-based). */
  sampleIndex: number;
}

interface ClipMeta {
  assetUrl: string;
  clipId: string;
  /** trimStartMs: source media position the clip starts from. */
  trimStartMs: number;
  speed: number;
}

// ─── Worker state ─────────────────────────────────────────────────────────────

let clipMeta: ClipMeta | null = null;
let videoDecoder: VideoDecoder | null = null;
let keyframeIndex: KeyframeEntry[] = [];
let allSamples: MP4Box.MP4Sample[] = [];
let videoTrackId = -1;
let audioTrackId = -1;
let isPlaying = false;
let playheadSampleIndex = 0;

// ─── VideoDecoder helpers ──────────────────────────────────────────────────────

function createVideoDecoder(videoTrack: MP4Box.MP4VideoTrack): VideoDecoder {
  const decoder = new VideoDecoder({
    output(frame) {
      if (!clipMeta) { frame.close(); return; }
      self.postMessage(
        { type: "FRAME", frame, timestampUs: frame.timestamp, clipId: clipMeta.clipId },
        // Transfer the frame — zero-copy. The main thread MUST call frame.close() after use.
        [frame as unknown as Transferable]
      );
    },
    error(e) {
      self.postMessage({ type: "ERROR", message: String(e), clipId: clipMeta?.clipId });
    },
  });

  decoder.configure({
    codec: videoTrack.codec,
    codedWidth: videoTrack.video.width,
    codedHeight: videoTrack.video.height,
    // mp4box provides the avcC / hvcC box as the description.
    description: getVideoDescription(videoTrack),
    hardwareAcceleration: "prefer-hardware",
  });

  return decoder;
}

/** Extract codec-specific init data (avcC, hvcC, etc.) from the mp4box track info. */
function getVideoDescription(track: MP4Box.MP4VideoTrack): Uint8Array | undefined {
  // mp4box exposes this via the trak → stsd → avcC/hvcC box bytes.
  // The track object has a `codec` string (e.g. "avc1.42E01E") and
  // samples carry their init data as `description`. We derive it from
  // the first sample's description if available, otherwise leave undefined
  // (browser will attempt to infer from codec string alone).
  const sample = allSamples.find((s) => s.track_id === track.id);
  return sample?.description ? new Uint8Array(sample.description as ArrayBuffer) : undefined;
}

// ─── Demux + keyframe index ────────────────────────────────────────────────────

async function loadAsset(url: string): Promise<{
  videoTrack: MP4Box.MP4VideoTrack;
  audioTrack: MP4Box.MP4AudioTrack | null;
}> {
  return new Promise((resolve, reject) => {
    const mp4boxFile = MP4Box.createFile();
    let videoTrack: MP4Box.MP4VideoTrack | null = null;
    let audioTrack: MP4Box.MP4AudioTrack | null = null;
    let fileOffset = 0;

    mp4boxFile.onError = reject;

    mp4boxFile.onReady = (info: MP4Box.MP4Info) => {
      // Find the first video and audio tracks.
      videoTrack =
        (info.videoTracks?.[0] as MP4Box.MP4VideoTrack | undefined) ?? null;
      audioTrack =
        (info.audioTracks?.[0] as MP4Box.MP4AudioTrack | undefined) ?? null;

      if (!videoTrack) {
        reject(new Error("No video track found in asset"));
        return;
      }

      videoTrackId = videoTrack.id;
      if (audioTrack) audioTrackId = audioTrack.id;

      // Start extracting video samples only. The audio track is discovered here,
      // but audio playback is intentionally owned by AudioMixer in Phase 3.
      mp4boxFile.setExtractionOptions(videoTrackId, null, { nbSamples: Infinity });
      mp4boxFile.start();
    };

    mp4boxFile.onSamples = (
      trackId: number,
      _user: unknown,
      samples: MP4Box.MP4Sample[]
    ) => {
      if (trackId === videoTrackId) {
        allSamples.push(...samples);

        // Build keyframe index from I-frames.
        for (const sample of samples) {
          if (sample.is_sync) {
            keyframeIndex.push({
              dts: sample.dts,
              offset: sample.offset,
              sampleIndex: allSamples.indexOf(sample),
            });
          }
        }
      }
    };

    // Fetch the full asset. For large files this should be range-request based;
    // for Phase 1 a full fetch is acceptable as the asset is already loaded in the browser cache.
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Asset fetch failed: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        // mp4box expects an ArrayBuffer with a fileStart property.
        const ab = buffer as ArrayBuffer & { fileStart: number };
        ab.fileStart = fileOffset;
        fileOffset += buffer.byteLength;
        mp4boxFile.appendBuffer(ab);
        mp4boxFile.flush();

        // Resolve once we have both track info and samples.
        // The onReady + onSamples callbacks have already fired synchronously.
        if (videoTrack) {
          resolve({ videoTrack, audioTrack });
        } else {
          reject(new Error("mp4box did not produce track info"));
        }
      })
      .catch(reject);
  });
}

// ─── Seek logic ────────────────────────────────────────────────────────────────

/**
 * GOP-aware seek: find the keyframe at or before targetMs (accounting for
 * trimStartMs and speed), reset the decoder, feed samples from that keyframe
 * to the target frame to reconstruct inter-frame dependencies.
 */
async function seekTo(targetMs: number): Promise<void> {
  if (!videoDecoder || !clipMeta || allSamples.length === 0) return;

  // Convert timeline time → source media time.
  // targetMs is already in source-media space (callers pass source time).
  const targetUs = targetMs * 1000;

  // Find the last keyframe at or before targetUs.
  let gopEntry = keyframeIndex[0];
  for (const entry of keyframeIndex) {
    if (entry.dts <= targetUs) gopEntry = entry;
    else break;
  }

  // Reset decoder to accept new keyframe.
  videoDecoder.reset();
  videoDecoder.configure({
    codec: (videoDecoder as any)._config?.codec ?? "",
    codedWidth: (videoDecoder as any)._config?.codedWidth ?? 0,
    codedHeight: (videoDecoder as any)._config?.codedHeight ?? 0,
    hardwareAcceleration: "prefer-hardware",
  });

  // Feed samples from GOP keyframe up to (and including) the target frame.
  const videoSamples = allSamples.filter((s) => s.track_id === videoTrackId);
  for (let i = gopEntry.sampleIndex; i < videoSamples.length; i++) {
    const sample = videoSamples[i];
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? "key" : "delta",
      timestamp: sample.dts,
      duration: sample.duration,
      data: sample.data as ArrayBuffer,
    });
    videoDecoder.decode(chunk);
    if (sample.dts >= targetUs) {
      playheadSampleIndex = i;
      break;
    }
  }

  await videoDecoder.flush();
  self.postMessage({ type: "SEEK_DONE", clipId: clipMeta.clipId });
}

// ─── Continuous decode loop ────────────────────────────────────────────────────

/**
 * Feed chunks ahead of the playhead while isPlaying is true.
 * Stops when the decoder queue is full or we run out of samples.
 */
function feedNextChunk(): void {
  if (!isPlaying || !videoDecoder) return;
  if (videoDecoder.decodeQueueSize > 8) {
    // Back-pressure: decoder queue is full. Retry after a short delay.
    setTimeout(feedNextChunk, 16);
    return;
  }

  const videoSamples = allSamples.filter((s) => s.track_id === videoTrackId);
  if (playheadSampleIndex >= videoSamples.length) {
    // End of clip.
    isPlaying = false;
    return;
  }

  const sample = videoSamples[playheadSampleIndex++];
  const chunk = new EncodedVideoChunk({
    type: sample.is_sync ? "key" : "delta",
    timestamp: sample.dts,
    duration: sample.duration,
    data: sample.data as ArrayBuffer,
  });
  videoDecoder.decode(chunk);
  // Schedule the next chunk without blocking.
  setTimeout(feedNextChunk, 0);
}

// ─── Message handler ───────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as
    | { type: "LOAD"; assetUrl: string; clipId: string; trimStartMs: number; speed: number }
    | { type: "SEEK"; targetMs: number }
    | { type: "PLAY" }
    | { type: "PAUSE" }
    | { type: "DESTROY" };

  switch (msg.type) {
    case "LOAD": {
      clipMeta = { assetUrl: msg.assetUrl, clipId: msg.clipId, trimStartMs: msg.trimStartMs, speed: msg.speed };
      keyframeIndex = [];
      allSamples = [];
      videoTrackId = -1;
      audioTrackId = -1;
      playheadSampleIndex = 0;

      try {
        const { videoTrack } = await loadAsset(msg.assetUrl);
        videoDecoder = createVideoDecoder(videoTrack);
        self.postMessage({ type: "READY", clipId: msg.clipId });
      } catch (e) {
        self.postMessage({ type: "ERROR", message: String(e), clipId: msg.clipId });
      }
      break;
    }

    case "SEEK": {
      isPlaying = false;
      await seekTo(msg.targetMs);
      break;
    }

    case "PLAY": {
      isPlaying = true;
      feedNextChunk();
      break;
    }

    case "PAUSE": {
      isPlaying = false;
      // Do NOT flush — we want to resume from the same position.
      break;
    }

    case "DESTROY": {
      isPlaying = false;
      videoDecoder?.reset();
      videoDecoder = null;
      allSamples = [];
      keyframeIndex = [];
      self.close();
      break;
    }
  }
};
```

---

## Step 3 — Create `DecoderPool.ts`

Create `frontend/src/features/editor/engine/DecoderPool.ts`:

```ts
/**
 * DecoderPool — manages one video ClipDecodeWorker per active clip.
 *
 * Active clips are those within DECODE_WINDOW_MS of the current playhead position.
 * Workers outside that window are destroyed to release memory and decoder resources.
 *
 * Usage:
 *   const pool = new DecoderPool(onFrame);
 *   pool.update(timeline, assetUrlMap, playheadMs);   // call on every timeline change or seek
 *   pool.seek(clipId, targetSourceMs);
 *   pool.play();
 *   pool.pause();
 *   pool.destroy();
 */

import type { Track, VideoClip, MediaClip } from "../types/editor";
import { isVideoClip, isMediaClip } from "../utils/clip-types";
import { getClipSourceTimeSecondsAtTimelineTime } from "../utils/editor-composition";

/** How far ahead/behind the playhead we keep decoders warm. */
const DECODE_WINDOW_MS = 5_000;

export interface DecodedFrame {
  frame: VideoFrame;
  timestampUs: number;
  clipId: string;
}

type FrameCallback = (decoded: DecodedFrame) => void;

interface WorkerEntry {
  worker: Worker;
  clipId: string;
  assetUrl: string;
  ready: boolean;
  pendingSeek: number | null; // source time in ms, applied once READY fires
}

export class DecoderPool {
  private workers = new Map<string, WorkerEntry>();
  private onFrame: FrameCallback;

  constructor(onFrame: FrameCallback) {
    this.onFrame = onFrame;
  }

  /**
   * Sync the pool against the current timeline state.
   * Creates workers for clips entering the window, destroys workers for clips leaving it.
   */
  update(tracks: Track[], assetUrlMap: Map<string, string>, playheadMs: number): void {
    const activeClipIds = new Set<string>();

    for (const track of tracks) {
      if (track.type !== "video") continue;
      for (const clip of track.clips.filter(isVideoClip)) {
        const clipEnd = clip.startMs + clip.durationMs;
        const inWindow =
          playheadMs >= clip.startMs - DECODE_WINDOW_MS &&
          playheadMs <= clipEnd + DECODE_WINDOW_MS;
        if (!inWindow) continue;

        activeClipIds.add(clip.id);
        const assetUrl = clip.assetId ? assetUrlMap.get(clip.assetId) : undefined;
        if (!assetUrl) continue;

        const existing = this.workers.get(clip.id);
        if (existing && existing.assetUrl === assetUrl) continue; // already loaded

        // New clip or asset URL changed — (re)create worker.
        this.destroyWorker(clip.id);
        this.createWorker(clip, assetUrl);
      }
    }

    // Destroy workers for clips no longer in the window.
    for (const clipId of this.workers.keys()) {
      if (!activeClipIds.has(clipId)) {
        this.destroyWorker(clipId);
      }
    }
  }

  /** Seek a specific worker to a source-media position (ms). */
  seek(clipId: string, sourceTimeMs: number): void {
    const entry = this.workers.get(clipId);
    if (!entry) return;
    if (!entry.ready) {
      entry.pendingSeek = sourceTimeMs;
      return;
    }
    entry.worker.postMessage({ type: "SEEK", targetMs: sourceTimeMs });
  }

  /** Seek all active workers to their correct source positions for the given playhead time. */
  seekAll(tracks: Track[], playheadMs: number): void {
    for (const track of tracks) {
      if (track.type !== "video") continue;
      for (const clip of track.clips.filter(isVideoClip)) {
        if (!this.workers.has(clip.id)) continue;
        const sourceTimeSec = getClipSourceTimeSecondsAtTimelineTime(clip, playheadMs);
        this.seek(clip.id, sourceTimeSec * 1000);
      }
    }
  }

  play(): void {
    for (const [, entry] of this.workers) {
      if (entry.ready) entry.worker.postMessage({ type: "PLAY" });
    }
  }

  pause(): void {
    for (const [, entry] of this.workers) {
      entry.worker.postMessage({ type: "PAUSE" });
    }
  }

  destroy(): void {
    for (const clipId of this.workers.keys()) {
      this.destroyWorker(clipId);
    }
    this.workers.clear();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private createWorker(clip: VideoClip, assetUrl: string): void {
    const worker = new Worker(
      new URL("./ClipDecodeWorker.ts", import.meta.url),
      { type: "module" }
    );

    const entry: WorkerEntry = {
      worker,
      clipId: clip.id,
      assetUrl,
      ready: false,
      pendingSeek: null,
    };

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case "READY":
          entry.ready = true;
          if (entry.pendingSeek !== null) {
            worker.postMessage({ type: "SEEK", targetMs: entry.pendingSeek });
            entry.pendingSeek = null;
          }
          break;
        case "FRAME":
          this.onFrame({ frame: msg.frame, timestampUs: msg.timestampUs, clipId: msg.clipId });
          break;
        case "SEEK_DONE":
          // No-op at pool level; compositor handles this.
          break;
        case "ERROR":
          console.error(`[DecoderPool] Worker error for clip ${msg.clipId}:`, msg.message);
          break;
      }
    };

    worker.onerror = (e) => {
      console.error(`[DecoderPool] Worker uncaught error for clip ${clip.id}:`, e);
    };

    this.workers.set(clip.id, entry);

    // Start loading.
    worker.postMessage({
      type: "LOAD",
      assetUrl,
      clipId: clip.id,
      trimStartMs: clip.trimStartMs,
      speed: clip.speed ?? 1,
    });
  }

  private destroyWorker(clipId: string): void {
    const entry = this.workers.get(clipId);
    if (!entry) return;
    entry.worker.postMessage({ type: "DESTROY" });
    // Give the worker a moment to close cleanly before terminating.
    setTimeout(() => entry.worker.terminate(), 200);
    this.workers.delete(clipId);
  }
}
```

---

## Step 4 — Vite Worker config

Vite must know to bundle `ClipDecodeWorker.ts` as a module Worker. No config change needed — the `new Worker(new URL(...), { type: 'module' })` pattern is handled automatically by Vite's worker bundler.

If you are using a strict CSP or custom Vite worker options, confirm that `worker.format` is `'es'` (the default). Check `frontend/vite.config.ts` — no change needed unless it has a `worker` key overriding the default.

---

## Step 5 — Verify

No visible change in the browser — the worker is not yet connected to the canvas. Verify by:

1. Open browser DevTools → Sources → find the compiled `ClipDecodeWorker` chunk under the worker URLs.
2. Open the editor with a project that has a video clip.
3. Add a temporary test shim in `DecoderPool.ts` constructor:

```ts
// TEMPORARY: delete before Phase 2
console.log("[DecoderPool] constructed");
```

4. Confirm the log appears when the editor loads.
5. Remove the test shim.
6. Confirm the worker emits `FRAME` / `SEEK_DONE` messages only; audio remains out of scope for Phase 1.
7. Run `bun run type-check` — zero errors.

---

## Known edge cases to handle in Phase 2

- `getVideoDescription()` implementation above is approximate. `mp4box.js` stores the codec init data differently per codec variant — test with a real H.264 asset and verify the description bytes are non-null. If `VideoDecoder.configure()` throws, the `description` field is the likely culprit.
- Workers fetch asset URLs cross-origin. If R2 signed URLs do not include `Access-Control-Allow-Origin: *`, the fetch will fail. Test this before Phase 2. If blocked, route through `/api/media` (same-origin proxy).
- Audio remains intentionally out of scope here. In Phase 3, `AudioMixer` will fetch/decode asset audio separately so it owns the clock and fallback behavior.

---

## Rollback

Delete `engine/ClipDecodeWorker.ts` and `engine/DecoderPool.ts`. The worker files are not imported by anything yet — this phase is additive and leaves the editor untouched.
