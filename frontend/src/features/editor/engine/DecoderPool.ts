/**
 * DecoderPool — **video clips only**, decoded **in parallel** (one `ClipDecodeWorker`
 * per clip near the playhead).
 *
 * Timeline model has many `Track` kinds (`video`, `audio`, `music`, `text`); this
 * pool is **not** the home for audio-only/music clips or captions — those are
 * scheduled elsewhere (see preview-engine-rewrite Phase 3 `AudioMixer`, Phase 4
 * captions). Here we only spin workers for **video** tracks + `VideoClip`s so
 * `VideoFrame`s can reach the compositor without blocking the main thread.
 *
 * Active clips = those within `DECODE_WINDOW_MS` of the playhead; others are
 * destroyed to free decoders and memory.
 *
 * Usage:
 *   const pool = new DecoderPool(onFrame);
 *   pool.update(timeline, assetUrlMap, playheadMs);   // manage worker membership / warm decoders
 *   pool.seekAll(timeline, playheadMs);               // realign active workers after seek/scrub
 *   pool.seek(clipId, targetSourceMs);
 *   pool.play();
 *   pool.pause();
 *   pool.destroy();
 */

import type { Track, VideoClip } from "../types/editor";
import { isVideoClip } from "../utils/clip-types";
import { getClipSourceTimeSecondsAtTimelineTime } from "../utils/editor-composition";
import {
  DECODE_FAILURE_COOLDOWN_MS,
  MAX_ACTIVE_VIDEO_WORKERS,
  MAX_WORKERS_PER_ASSET_URL,
  getClipDecodePriority,
} from "./decode-guard";

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
  pendingSeek: { targetMs: number; seekToken: number } | null;
  destroyed: boolean;
  seeking: boolean;
  playAfterSeek: boolean;
  terminateTimer: number | null;
  latestRequestedSeekToken: number;
  activeSeekToken: number | null;
}

/** Parallel **video** decode only; see file header for how other track types are handled. */
export class DecoderPool {
  private workers = new Map<string, WorkerEntry>();
  private assetFailuresUntil = new Map<string, number>();
  private isPlaying = false;
  private onFrame: FrameCallback;

  /**
   * Registers the callback for worker output: `onFrame` receives transferred
   * `VideoFrame`s from the worker.
   */
  constructor(onFrame: FrameCallback) {
    this.onFrame = onFrame;
  }

  /**
   * Reconciles workers with **video** clips whose timeline range intersects
   * `[playhead ± DECODE_WINDOW_MS]`. Resolves `assetId` → URL from `assetUrlMap`;
   * `(re)createWorker` if missing or URL changed; `destroyWorker` for clips
   * outside the window or removed from the computed active set.
   */
  update(
    tracks: Track[],
    assetUrlMap: Map<string, string>,
    playheadMs: number
  ): void {
    const activeClipIds = new Set<string>();
    const candidates: Array<{
      clip: VideoClip;
      assetUrl: string;
      priority: number;
    }> = [];
    const now = Date.now();

    for (const track of tracks) {
      if (track.type !== "video") continue;
      for (const clip of track.clips.filter(isVideoClip)) {
        const clipEnd = clip.startMs + clip.durationMs;
        const inWindow =
          playheadMs >= clip.startMs - DECODE_WINDOW_MS &&
          playheadMs <= clipEnd + DECODE_WINDOW_MS;
        if (!inWindow) continue;

        activeClipIds.add(clip.id);
        const assetUrl = clip.assetId
          ? assetUrlMap.get(clip.assetId)
          : undefined;
        if (!assetUrl) continue;
        const blockedUntil = this.assetFailuresUntil.get(assetUrl);
        if (blockedUntil && blockedUntil > now) continue;
        if (blockedUntil && blockedUntil <= now) {
          this.assetFailuresUntil.delete(assetUrl);
        }

        candidates.push({
          clip,
          assetUrl,
          priority: getClipDecodePriority(clip, playheadMs),
        });
      }
    }

    candidates.sort((a, b) => a.priority - b.priority);
    const permittedClipIds = new Set<string>();
    const perAssetCounts = new Map<string, number>();
    for (const { clip, assetUrl } of candidates) {
      if (permittedClipIds.size >= MAX_ACTIVE_VIDEO_WORKERS) break;
      const assetCount = perAssetCounts.get(assetUrl) ?? 0;
      if (assetCount >= MAX_WORKERS_PER_ASSET_URL) continue;
      permittedClipIds.add(clip.id);
      perAssetCounts.set(assetUrl, assetCount + 1);
    }

    for (const { clip, assetUrl } of candidates) {
      if (!permittedClipIds.has(clip.id)) continue;

      const existing = this.workers.get(clip.id);
      if (existing && existing.assetUrl === assetUrl) continue; // already loaded

      // New clip or asset URL changed — (re)create worker.
      this.destroyWorker(clip.id);
      const sourceTimeMs =
        getClipSourceTimeSecondsAtTimelineTime(clip, playheadMs) * 1000;
      this.createWorker(clip, assetUrl, sourceTimeMs);
    }

    // Destroy workers for clips no longer in the window.
    for (const clipId of this.workers.keys()) {
      if (!activeClipIds.has(clipId) || !permittedClipIds.has(clipId)) {
        this.destroyWorker(clipId);
      }
    }
  }

  /**
   * Sends `SEEK` with **source** time in ms for one clip. If demux is not
   * finished (`!ready`), stores `pendingSeek` and applies it on first `READY`.
   */
  seek(clipId: string, sourceTimeMs: number): void {
    const entry = this.workers.get(clipId);
    if (!entry) return;
    entry.playAfterSeek = this.isPlaying;
    const seekToken = entry.latestRequestedSeekToken + 1;
    entry.latestRequestedSeekToken = seekToken;
    if (!entry.ready) {
      entry.pendingSeek = { targetMs: sourceTimeMs, seekToken };
      return;
    }
    if (entry.seeking) {
      entry.pendingSeek = { targetMs: sourceTimeMs, seekToken };
      return;
    }
    this.dispatchSeek(entry, sourceTimeMs, seekToken);
  }

  /**
   * For every **video** clip that already has a worker, maps timeline
   * `playheadMs` → source seconds via `getClipSourceTimeSecondsAtTimelineTime`,
   * then `seek(clipId, ms)`. Use after scrubs or layout changes so each
   * decoder’s internal timeline matches the composition.
   */
  seekAll(tracks: Track[], playheadMs: number): void {
    for (const track of tracks) {
      if (track.type !== "video") continue;
      for (const clip of track.clips.filter(isVideoClip)) {
        if (!this.workers.has(clip.id)) continue;
        const sourceTimeSec = getClipSourceTimeSecondsAtTimelineTime(
          clip,
          playheadMs
        );
        this.seek(clip.id, sourceTimeSec * 1000);
      }
    }
  }

  /**
   * `PLAY` on all workers that have received `READY` (skips still-loading entries
   * so their internal pump does not start before samples exist).
   */
  play(): void {
    this.isPlaying = true;
    for (const [, entry] of this.workers) {
      if (!entry.ready || entry.seeking) {
        entry.playAfterSeek = true;
        continue;
      }
      entry.worker.postMessage({ type: "PLAY" });
    }
  }

  /**
   * `PAUSE` on every tracked worker (including not-yet-ready) so nothing keeps
   * scheduling decode once the pool stops playback.
   */
  pause(): void {
    this.isPlaying = false;
    for (const [, entry] of this.workers) {
      entry.playAfterSeek = false;
      entry.worker.postMessage({ type: "PAUSE" });
    }
  }

  /**
   * `DESTROY` + terminate every worker and clears the map. The pool object stays
   * valid; call `update` again when you have a new timeline / URLs to warm workers.
   */
  destroy(): void {
    for (const clipId of this.workers.keys()) {
      this.destroyWorker(clipId);
    }
    this.workers.clear();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Spawns a module worker for `ClipDecodeWorker`, registers `onmessage` to
   * flip `ready`, drain `pendingSeek`, and forward `FRAME` /
   * errors, then posts `LOAD` for the clip asset. Entry is stored before load completes.
   */
  private createWorker(
    clip: VideoClip,
    assetUrl: string,
    initialSourceTimeMs: number
  ): void {
    const worker = new Worker(
      new URL("./ClipDecodeWorker.ts", import.meta.url),
      { type: "module" }
    );

    const entry: WorkerEntry = {
      worker,
      clipId: clip.id,
      assetUrl,
      ready: false,
      pendingSeek: { targetMs: initialSourceTimeMs, seekToken: 1 },
      destroyed: false,
      seeking: false,
      playAfterSeek: this.isPlaying,
      terminateTimer: null,
      latestRequestedSeekToken: 1,
      activeSeekToken: null,
    };

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (entry.destroyed) {
        if (
          msg &&
          typeof msg === "object" &&
          "type" in msg &&
          msg.type === "FRAME" &&
          "frame" in msg &&
          msg.frame &&
          typeof msg.frame.close === "function"
        ) {
          msg.frame.close();
        }
        return;
      }
      switch (msg.type) {
        case "READY":
          entry.ready = true;
          if (entry.pendingSeek !== null) {
            this.dispatchSeek(
              entry,
              entry.pendingSeek.targetMs,
              entry.pendingSeek.seekToken
            );
            break;
          }
          if (this.isPlaying) worker.postMessage({ type: "PLAY" });
          break;
        case "FRAME":
          if (
            (msg.seekToken ?? null) !== null &&
            msg.seekToken !== entry.latestRequestedSeekToken
          ) {
            msg.frame.close();
            break;
          }
          if (
            (entry.seeking || entry.pendingSeek !== null) &&
            (msg.seekToken ?? null) === null
          ) {
            msg.frame.close();
            break;
          }
          this.onFrame({
            frame: msg.frame,
            timestampUs: msg.timestampUs,
            clipId: msg.clipId,
          });
          break;
        case "SEEK_DONE":
          if ((msg.seekToken ?? null) !== entry.activeSeekToken) {
            break;
          }
          if (entry.pendingSeek !== null) {
            this.dispatchSeek(
              entry,
              entry.pendingSeek.targetMs,
              entry.pendingSeek.seekToken
            );
            break;
          }
          entry.seeking = false;
          entry.activeSeekToken = null;
          if (entry.playAfterSeek && this.isPlaying) {
            entry.playAfterSeek = false;
            worker.postMessage({ type: "PLAY" });
          }
          break;
        case "SEEK_FAILED":
          if ((msg.seekToken ?? null) !== entry.activeSeekToken) {
            break;
          }
          if (entry.destroyed) break;
          this.handleWorkerFailure(
            entry,
            `Seek failed for clip ${msg.clipId}:`,
            msg.message
          );
          break;
        case "ERROR":
          if (entry.destroyed) break;
          this.handleWorkerFailure(
            entry,
            `Worker error for clip ${msg.clipId}:`,
            msg.message
          );
          break;
      }
    };

    worker.onerror = (e) => {
      if (entry.destroyed) return;
      this.handleWorkerFailure(
        entry,
        `Worker uncaught error for clip ${clip.id}:`,
        e
      );
    };

    this.workers.set(clip.id, entry);

    // Start loading.
    worker.postMessage({
      type: "LOAD",
      assetUrl,
      clipId: clip.id,
    });
  }

  private dispatchSeek(
    entry: WorkerEntry,
    sourceTimeMs: number,
    seekToken: number
  ): void {
    entry.pendingSeek = null;
    entry.seeking = true;
    entry.activeSeekToken = seekToken;
    entry.worker.postMessage({
      type: "SEEK",
      targetMs: sourceTimeMs,
      seekToken,
    });
  }

  private handleWorkerFailure(
    entry: WorkerEntry,
    prefix: string,
    error: unknown
  ): void {
    this.assetFailuresUntil.set(
      entry.assetUrl,
      Date.now() + DECODE_FAILURE_COOLDOWN_MS
    );
    console.error(`[DecoderPool] ${prefix}`, error);
    this.destroyWorker(entry.clipId);
  }

  /**
   * Tells the worker `DESTROY` (graceful teardown inside), removes the map
   * entry immediately, and `terminate()`s after a short delay so `close()` can run.
   */
  private destroyWorker(clipId: string): void {
    const entry = this.workers.get(clipId);
    if (!entry) return;
    entry.destroyed = true;
    if (entry.terminateTimer !== null) {
      clearTimeout(entry.terminateTimer);
    }
    entry.worker.postMessage({ type: "DESTROY" });
    // Give the worker a moment to close cleanly before terminating.
    entry.terminateTimer = window.setTimeout(
      () => entry.worker.terminate(),
      200
    );
    this.workers.delete(clipId);
  }
}
