/**
 * DecoderPool - video clips only, decoded in parallel.
 *
 * Owns the set of ClipDecodeWorker instances near the playhead. It decides
 * which video clips should be warm, shares demux metadata by asset URL, forwards
 * seeks/play/pause, and passes decoded VideoFrames to the compositor bridge.
 *
 * Where this sits:
 *   PreviewEngine -> DecoderPool -> ClipDecodeWorker(s) -> VideoFrame callback
 *          |                                                   |
 *          +---------------- PreviewCanvas/CompositorWorker <--+
 *
 * Important rules:
 *   - One worker represents one video clip instance, not one asset URL.
 *   - Multiple clips can share an asset, so demux metadata is cached by asset URL.
 *   - VideoFrames are transferred objects. If a frame is stale or its worker was
 *     destroyed, DecoderPool must close it instead of forwarding it.
 *   - Seek tokens make rapid scrubbing deterministic: only frames from the newest
 *     requested seek are accepted.
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
import type { CachedDemuxMetadata } from "./ClipDecodeWorker";

/** How far ahead/behind the playhead we keep decoders warm. */
const DECODE_WINDOW_MS = 5_000;
const MAX_DEMUX_METADATA_CACHE_ENTRIES = 3;

export interface DecodedFrame {
  frame: VideoFrame;
  timestampUs: number;
  clipId: string;
}

export interface DecoderPoolMetrics {
  activeDecoderCount: number;
  maxActiveDecoderCount: number;
  readyDecoderCount: number;
  seekingDecoderCount: number;
  pendingSeekCount: number;
  assetWorkerCounts: Record<string, number>;
  maxWorkersPerAssetUrl: number;
  metadataCache: {
    entryCount: number;
    assetUrls: string[];
  };
  clipSeekMetrics: Record<string, ClipSeekMetrics>;
  clipIds: string[];
}

export interface ClipSeekMetrics {
  lastRequestedAtMs: number | null;
  lastTargetMs: number | null;
  lastFirstAcceptedFrameMs: number | null;
  staleFrameDropCount: number;
  acceptedFrameCount: number;
}

type FrameCallback = (decoded: DecodedFrame) => void;

interface DecodeCandidate {
  clip: VideoClip;
  assetUrl: string;
  priority: number;
}

interface PendingSeek {
  targetMs: number;
  seekToken: number;
}

interface WorkerEntry {
  worker: Worker;
  clipId: string;
  assetUrl: string;
  /** LOAD finished and the worker can accept immediate SEEK/PLAY messages. */
  ready: boolean;
  /** Latest source-time seek waiting for READY or current seek completion. */
  pendingSeek: PendingSeek | null;
  destroyed: boolean;
  seeking: boolean;
  /** Playback should resume when an in-flight seek completes. */
  playAfterSeek: boolean;
  terminateTimer: number | null;
  /** Monotonic token for seek/frame freshness. */
  latestRequestedSeekToken: number;
  activeSeekToken: number | null;
  /** This entry is currently demuxing an asset for metadata cache warmup. */
  metadataLoader: boolean;
  seekMetrics: ClipSeekMetrics;
}

interface MetadataCacheEntry {
  metadata: CachedDemuxMetadata;
  lastUsedAtMs: number;
}

type ClipDecodeWorkerMessage =
  | {
      type: "METADATA_READY";
      clipId: string;
      assetUrl: string;
      metadata: CachedDemuxMetadata;
    }
  | { type: "READY"; clipId: string }
  | {
      type: "FRAME";
      frame: VideoFrame;
      timestampUs: number;
      clipId: string;
      seekToken?: number | null;
    }
  | { type: "SEEK_DONE"; clipId: string; seekToken?: number | null }
  | {
      type: "SEEK_FAILED";
      message: string;
      clipId?: string;
      seekToken?: number | null;
    }
  | { type: "ERROR"; message: string; clipId?: string };

export class DecoderPool {
  /** Worker entries keyed by clip id. */
  private readonly workers = new Map<string, WorkerEntry>();
  /** Asset URLs temporarily blocked after decoder/load failure. */
  private readonly assetFailuresUntil = new Map<string, number>();
  /** Small LRU-ish cache of demux results reused across clips of same asset. */
  private readonly metadataCache = new Map<string, MetadataCacheEntry>();
  /** Workers waiting for another worker to finish demuxing the same asset URL. */
  private readonly metadataWaiters = new Map<string, Set<WorkerEntry>>();
  /** Asset URLs with exactly one active metadata-loader worker. */
  private readonly metadataLoadsInFlight = new Set<string>();

  private isPlaying = false;

  constructor(private readonly onFrame: FrameCallback) {}

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Reconciles workers with video clips whose timeline range intersects the
   * decode window around the playhead.
   */
  update(
    tracks: Track[],
    assetUrlMap: Map<string, string>,
    playheadMs: number
  ): void {
    const { activeClipIds, candidates } = this.collectDecodeCandidates(
      tracks,
      assetUrlMap,
      playheadMs
    );
    const permittedClipIds = this.pickPermittedClipIds(candidates);

    this.ensureWorkersForCandidates(candidates, permittedClipIds, playheadMs);
    this.destroyWorkersOutsideSet(activeClipIds, permittedClipIds);
  }

  /**
   * Sends a source-time seek to one worker. If the worker is loading or already
   * seeking, the newest seek is remembered and applied when ready.
   */
  seek(clipId: string, sourceTimeMs: number): void {
    const entry = this.workers.get(clipId);
    if (!entry) return;

    const seekToken = this.nextSeekToken(entry);
    entry.playAfterSeek = this.isPlaying;

    if (!entry.ready || entry.seeking) {
      entry.pendingSeek = { targetMs: sourceTimeMs, seekToken };
      return;
    }

    this.dispatchSeek(entry, sourceTimeMs, seekToken);
  }

  /**
   * Realigns every active video decoder to its source time for the timeline
   * playhead. Use after scrubs or timeline changes.
   */
  seekAll(tracks: Track[], playheadMs: number): void {
    for (const clip of this.iterVideoClips(tracks)) {
      if (!this.workers.has(clip.id)) continue;
      this.seek(clip.id, this.getClipSourceTimeMs(clip, playheadMs));
    }
  }

  play(): void {
    this.isPlaying = true;

    for (const entry of this.workers.values()) {
      if (!entry.ready || entry.seeking) {
        entry.playAfterSeek = true;
        continue;
      }

      entry.worker.postMessage({ type: "PLAY" });
    }
  }

  pause(): void {
    this.isPlaying = false;

    for (const entry of this.workers.values()) {
      entry.playAfterSeek = false;
      entry.worker.postMessage({ type: "PAUSE" });
    }
  }

  destroy(): void {
    for (const clipId of Array.from(this.workers.keys())) {
      this.destroyWorker(clipId);
    }
    this.workers.clear();
    this.metadataWaiters.clear();
    this.metadataLoadsInFlight.clear();
  }

  getMetrics(): DecoderPoolMetrics {
    const assetWorkerCounts: Record<string, number> = {};
    let readyDecoderCount = 0;
    let seekingDecoderCount = 0;
    let pendingSeekCount = 0;

    for (const entry of this.workers.values()) {
      assetWorkerCounts[entry.assetUrl] =
        (assetWorkerCounts[entry.assetUrl] ?? 0) + 1;
      if (entry.ready) readyDecoderCount += 1;
      if (entry.seeking) seekingDecoderCount += 1;
      if (entry.pendingSeek !== null) pendingSeekCount += 1;
    }

    return {
      activeDecoderCount: this.workers.size,
      maxActiveDecoderCount: MAX_ACTIVE_VIDEO_WORKERS,
      readyDecoderCount,
      seekingDecoderCount,
      pendingSeekCount,
      assetWorkerCounts,
      maxWorkersPerAssetUrl: MAX_WORKERS_PER_ASSET_URL,
      metadataCache: {
        entryCount: this.metadataCache.size,
        assetUrls: [...this.metadataCache.keys()],
      },
      clipSeekMetrics: Object.fromEntries(
        [...this.workers.values()].map((entry) => [
          entry.clipId,
          { ...entry.seekMetrics },
        ])
      ),
      clipIds: [...this.workers.keys()],
    };
  }

  // ---------------------------------------------------------------------------
  // Worker reconciliation
  // ---------------------------------------------------------------------------

  private collectDecodeCandidates(
    tracks: Track[],
    assetUrlMap: Map<string, string>,
    playheadMs: number
  ): { activeClipIds: Set<string>; candidates: DecodeCandidate[] } {
    const activeClipIds = new Set<string>();
    const candidates: DecodeCandidate[] = [];
    const now = Date.now();

    for (const clip of this.iterVideoClips(tracks)) {
      if (!this.isClipInDecodeWindow(clip, playheadMs)) continue;

      // activeClipIds tracks window membership even if asset URL is missing, so
      // workers disappear when clips leave the window or worker limits exclude them.
      activeClipIds.add(clip.id);

      const assetUrl = clip.assetId ? assetUrlMap.get(clip.assetId) : undefined;
      if (!assetUrl || this.isAssetCoolingDown(assetUrl, now)) continue;

      candidates.push({
        clip,
        assetUrl,
        priority: getClipDecodePriority(clip, playheadMs),
      });
    }

    candidates.sort((a, b) => a.priority - b.priority);
    return { activeClipIds, candidates };
  }

  private pickPermittedClipIds(candidates: DecodeCandidate[]): Set<string> {
    const permittedClipIds = new Set<string>();
    const perAssetCounts = new Map<string, number>();

    for (const { clip, assetUrl } of candidates) {
      if (permittedClipIds.size >= MAX_ACTIVE_VIDEO_WORKERS) break;

      const assetCount = perAssetCounts.get(assetUrl) ?? 0;
      if (assetCount >= MAX_WORKERS_PER_ASSET_URL) continue;

      permittedClipIds.add(clip.id);
      perAssetCounts.set(assetUrl, assetCount + 1);
    }

    return permittedClipIds;
  }

  private ensureWorkersForCandidates(
    candidates: DecodeCandidate[],
    permittedClipIds: Set<string>,
    playheadMs: number
  ): void {
    for (const { clip, assetUrl } of candidates) {
      if (!permittedClipIds.has(clip.id)) continue;

      const existing = this.workers.get(clip.id);
      if (existing?.assetUrl === assetUrl) continue;

      // Recreate on URL changes so the worker never decodes from a stale asset.
      this.destroyWorker(clip.id);
      this.createWorker(
        clip,
        assetUrl,
        this.getClipSourceTimeMs(clip, playheadMs)
      );
    }
  }

  private destroyWorkersOutsideSet(
    activeClipIds: Set<string>,
    permittedClipIds: Set<string>
  ): void {
    for (const clipId of Array.from(this.workers.keys())) {
      if (!activeClipIds.has(clipId) || !permittedClipIds.has(clipId)) {
        this.destroyWorker(clipId);
      }
    }
  }

  private createWorker(
    clip: VideoClip,
    assetUrl: string,
    initialSourceTimeMs: number
  ): void {
    const worker = new Worker(
      new URL("./ClipDecodeWorker.ts", import.meta.url),
      { type: "module" }
    );
    const entry = this.createWorkerEntry(
      worker,
      clip.id,
      assetUrl,
      initialSourceTimeMs
    );

    worker.onmessage = (event: MessageEvent) => {
      this.handleWorkerMessage(entry, event.data as ClipDecodeWorkerMessage);
    };

    worker.onerror = (error) => {
      if (entry.destroyed) return;
      this.handleWorkerFailure(
        entry,
        `Worker uncaught error for clip ${clip.id}:`,
        error
      );
    };

    this.workers.set(clip.id, entry);
    this.startWorkerLoad(entry);
  }

  private createWorkerEntry(
    worker: Worker,
    clipId: string,
    assetUrl: string,
    initialSourceTimeMs: number
  ): WorkerEntry {
    return {
      worker,
      clipId,
      assetUrl,
      ready: false,
      pendingSeek: { targetMs: initialSourceTimeMs, seekToken: 1 },
      destroyed: false,
      seeking: false,
      playAfterSeek: this.isPlaying,
      terminateTimer: null,
      latestRequestedSeekToken: 1,
      activeSeekToken: null,
      metadataLoader: false,
      seekMetrics: {
        lastRequestedAtMs: null,
        lastTargetMs: null,
        lastFirstAcceptedFrameMs: null,
        staleFrameDropCount: 0,
        acceptedFrameCount: 0,
      },
    };
  }

  private destroyWorker(clipId: string): void {
    const entry = this.workers.get(clipId);
    if (!entry) return;

    entry.destroyed = true;
    if (entry.terminateTimer !== null) {
      clearTimeout(entry.terminateTimer);
    }

    this.releaseMetadataOwnership(entry);
    entry.worker.postMessage({ type: "DESTROY" });
    // Worker does its own cleanup first; terminate is the fallback if it hangs.
    entry.terminateTimer = window.setTimeout(
      () => entry.worker.terminate(),
      200
    );
    this.workers.delete(clipId);
  }

  // ---------------------------------------------------------------------------
  // Worker messages
  // ---------------------------------------------------------------------------

  private handleWorkerMessage(
    entry: WorkerEntry,
    message: ClipDecodeWorkerMessage
  ): void {
    if (entry.destroyed) {
      this.closeFrameFromDestroyedEntry(message);
      return;
    }

    switch (message.type) {
      case "METADATA_READY":
        this.handleMetadataReady(entry, message);
        break;
      case "READY":
        this.handleWorkerReady(entry);
        break;
      case "FRAME":
        this.handleDecodedFrame(entry, message);
        break;
      case "SEEK_DONE":
        this.handleSeekDone(entry, message.seekToken ?? null);
        break;
      case "SEEK_FAILED":
        this.handleSeekFailed(entry, message);
        break;
      case "ERROR":
        this.handleWorkerError(entry, message);
        break;
    }
  }

  private handleMetadataReady(
    entry: WorkerEntry,
    message: Extract<ClipDecodeWorkerMessage, { type: "METADATA_READY" }>
  ): void {
    if (message.assetUrl !== entry.assetUrl) return;

    entry.metadataLoader = false;
    this.metadataLoadsInFlight.delete(entry.assetUrl);
    this.rememberMetadata(entry.assetUrl, message.metadata);
    this.releaseMetadataWaiters(entry.assetUrl, message.metadata);
  }

  private handleWorkerReady(entry: WorkerEntry): void {
    entry.ready = true;

    if (entry.pendingSeek !== null) {
      this.dispatchPendingSeek(entry);
      return;
    }

    if (this.isPlaying) {
      entry.worker.postMessage({ type: "PLAY" });
    }
  }

  private handleDecodedFrame(
    entry: WorkerEntry,
    message: Extract<ClipDecodeWorkerMessage, { type: "FRAME" }>
  ): void {
    if (this.shouldDropFrame(entry, message.seekToken ?? null)) {
      entry.seekMetrics.staleFrameDropCount += 1;
      message.frame.close();
      return;
    }

    entry.seekMetrics.acceptedFrameCount += 1;
    this.recordFirstAcceptedSeekFrame(entry);
    this.onFrame({
      frame: message.frame,
      timestampUs: message.timestampUs,
      clipId: message.clipId,
    });
  }

  private handleSeekDone(entry: WorkerEntry, seekToken: number | null): void {
    if (seekToken !== entry.activeSeekToken) return;

    if (entry.pendingSeek !== null) {
      this.dispatchPendingSeek(entry);
      return;
    }

    entry.seeking = false;
    entry.activeSeekToken = null;

    if (entry.playAfterSeek && this.isPlaying) {
      entry.playAfterSeek = false;
      entry.worker.postMessage({ type: "PLAY" });
    }
  }

  private handleSeekFailed(
    entry: WorkerEntry,
    message: Extract<ClipDecodeWorkerMessage, { type: "SEEK_FAILED" }>
  ): void {
    if ((message.seekToken ?? null) !== entry.activeSeekToken) return;

    this.handleWorkerFailure(
      entry,
      `Seek failed for clip ${message.clipId}:`,
      message.message
    );
  }

  private handleWorkerError(
    entry: WorkerEntry,
    message: Extract<ClipDecodeWorkerMessage, { type: "ERROR" }>
  ): void {
    this.handleWorkerFailure(
      entry,
      `Worker error for clip ${message.clipId}:`,
      message.message
    );
  }

  private shouldDropFrame(
    entry: WorkerEntry,
    seekToken: number | null
  ): boolean {
    if (seekToken !== null && seekToken !== entry.latestRequestedSeekToken) {
      return true;
    }

    // While a seek is pending, untagged playback frames belong to the old position.
    return (entry.seeking || entry.pendingSeek !== null) && seekToken === null;
  }

  private recordFirstAcceptedSeekFrame(entry: WorkerEntry): void {
    if (
      entry.seekMetrics.lastRequestedAtMs === null ||
      entry.seekMetrics.lastFirstAcceptedFrameMs !== null
    ) {
      return;
    }

    entry.seekMetrics.lastFirstAcceptedFrameMs =
      performance.now() - entry.seekMetrics.lastRequestedAtMs;
  }

  private closeFrameFromDestroyedEntry(message: ClipDecodeWorkerMessage): void {
    if (message.type === "FRAME") {
      message.frame.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Seeking
  // ---------------------------------------------------------------------------

  private nextSeekToken(entry: WorkerEntry): number {
    entry.latestRequestedSeekToken += 1;
    return entry.latestRequestedSeekToken;
  }

  private dispatchPendingSeek(entry: WorkerEntry): void {
    if (!entry.pendingSeek) return;
    this.dispatchSeek(
      entry,
      entry.pendingSeek.targetMs,
      entry.pendingSeek.seekToken
    );
  }

  private dispatchSeek(
    entry: WorkerEntry,
    sourceTimeMs: number,
    seekToken: number
  ): void {
    entry.pendingSeek = null;
    entry.seeking = true;
    entry.activeSeekToken = seekToken;
    entry.seekMetrics.lastRequestedAtMs = performance.now();
    entry.seekMetrics.lastTargetMs = sourceTimeMs;
    entry.seekMetrics.lastFirstAcceptedFrameMs = null;
    entry.worker.postMessage({
      type: "SEEK",
      targetMs: sourceTimeMs,
      seekToken,
    });
  }

  // ---------------------------------------------------------------------------
  // Metadata sharing
  // ---------------------------------------------------------------------------

  private startWorkerLoad(entry: WorkerEntry): void {
    const cachedMetadata = this.getCachedMetadata(entry.assetUrl);
    if (cachedMetadata) {
      this.postLoad(entry, cachedMetadata);
      return;
    }

    if (this.metadataLoadsInFlight.has(entry.assetUrl)) {
      // Another clip is already demuxing this asset. Wait and then LOAD with
      // cached metadata instead of making every worker parse the same MP4.
      this.addMetadataWaiter(entry);
      return;
    }

    this.metadataLoadsInFlight.add(entry.assetUrl);
    entry.metadataLoader = true;
    this.postLoad(entry);
  }

  private postLoad(entry: WorkerEntry, metadata?: CachedDemuxMetadata): void {
    entry.worker.postMessage({
      type: "LOAD",
      assetUrl: entry.assetUrl,
      clipId: entry.clipId,
      ...(metadata ? { metadata } : {}),
    });
  }

  private addMetadataWaiter(entry: WorkerEntry): void {
    const waiters =
      this.metadataWaiters.get(entry.assetUrl) ?? new Set<WorkerEntry>();
    waiters.add(entry);
    this.metadataWaiters.set(entry.assetUrl, waiters);
  }

  private getCachedMetadata(assetUrl: string): CachedDemuxMetadata | null {
    const entry = this.metadataCache.get(assetUrl);
    if (!entry) return null;

    entry.lastUsedAtMs = performance.now();
    return entry.metadata;
  }

  private rememberMetadata(
    assetUrl: string,
    metadata: CachedDemuxMetadata
  ): void {
    this.metadataCache.set(assetUrl, {
      metadata,
      lastUsedAtMs: performance.now(),
    });
    this.evictOldMetadataIfNeeded();
  }

  private evictOldMetadataIfNeeded(): void {
    if (this.metadataCache.size <= MAX_DEMUX_METADATA_CACHE_ENTRIES) return;

    let oldestAssetUrl: string | null = null;
    let oldestUsedAtMs = Number.POSITIVE_INFINITY;

    for (const [assetUrl, entry] of this.metadataCache) {
      if (entry.lastUsedAtMs >= oldestUsedAtMs) continue;
      oldestAssetUrl = assetUrl;
      oldestUsedAtMs = entry.lastUsedAtMs;
    }

    if (oldestAssetUrl) {
      this.metadataCache.delete(oldestAssetUrl);
    }
  }

  private releaseMetadataWaiters(
    assetUrl: string,
    metadata: CachedDemuxMetadata | null
  ): void {
    const waiters = this.metadataWaiters.get(assetUrl);
    if (!waiters) return;

    this.metadataWaiters.delete(assetUrl);
    const liveWaiters = [...waiters].filter(
      (waiter) => !waiter.destroyed && this.workers.has(waiter.clipId)
    );

    if (metadata) {
      // Happy path: all waiters can skip demux and configure from shared metadata.
      for (const waiter of liveWaiters) {
        this.postLoad(waiter, metadata);
      }
      return;
    }

    this.promoteNextMetadataWaiter(assetUrl, liveWaiters);
  }

  private promoteNextMetadataWaiter(
    assetUrl: string,
    liveWaiters: WorkerEntry[]
  ): void {
    const [loader, ...remainingWaiters] = liveWaiters;
    if (!loader) return;

    // If the metadata loader was destroyed before finishing, choose one waiter
    // to become the new loader and keep the rest waiting.
    this.metadataLoadsInFlight.add(loader.assetUrl);
    loader.metadataLoader = true;
    this.postLoad(loader);

    if (remainingWaiters.length > 0) {
      this.metadataWaiters.set(assetUrl, new Set(remainingWaiters));
    }
  }

  private releaseMetadataOwnership(entry: WorkerEntry): void {
    if (entry.metadataLoader) {
      entry.metadataLoader = false;
      this.metadataLoadsInFlight.delete(entry.assetUrl);
      this.releaseMetadataWaiters(entry.assetUrl, null);
    }

    const waiters = this.metadataWaiters.get(entry.assetUrl);
    if (!waiters) return;

    waiters.delete(entry);
    if (waiters.size === 0) {
      this.metadataWaiters.delete(entry.assetUrl);
    }
  }

  private destroyMetadataWaiters(assetUrl: string): void {
    const waiters = this.metadataWaiters.get(assetUrl);
    if (!waiters) return;

    this.metadataWaiters.delete(assetUrl);

    for (const waiter of waiters) {
      if (waiter.destroyed) continue;
      this.destroyWorker(waiter.clipId);
    }
  }

  // ---------------------------------------------------------------------------
  // Failures and small helpers
  // ---------------------------------------------------------------------------

  private handleWorkerFailure(
    entry: WorkerEntry,
    prefix: string,
    error: unknown
  ): void {
    this.assetFailuresUntil.set(
      entry.assetUrl,
      Date.now() + DECODE_FAILURE_COOLDOWN_MS
    );

    if (entry.metadataLoader) {
      entry.metadataLoader = false;
      this.metadataLoadsInFlight.delete(entry.assetUrl);
      this.destroyMetadataWaiters(entry.assetUrl);
    }

    console.error(`[DecoderPool] ${prefix}`, error);
    this.destroyWorker(entry.clipId);
  }

  private isAssetCoolingDown(assetUrl: string, now: number): boolean {
    const blockedUntil = this.assetFailuresUntil.get(assetUrl);
    if (!blockedUntil) return false;

    if (blockedUntil <= now) {
      this.assetFailuresUntil.delete(assetUrl);
      return false;
    }

    return true;
  }

  private isClipInDecodeWindow(clip: VideoClip, playheadMs: number): boolean {
    const clipEnd = clip.startMs + clip.durationMs;
    return (
      playheadMs >= clip.startMs - DECODE_WINDOW_MS &&
      playheadMs <= clipEnd + DECODE_WINDOW_MS
    );
  }

  private getClipSourceTimeMs(clip: VideoClip, playheadMs: number): number {
    return getClipSourceTimeSecondsAtTimelineTime(clip, playheadMs) * 1000;
  }

  private *iterVideoClips(tracks: Track[]): Iterable<VideoClip> {
    for (const track of tracks) {
      if (track.type !== "video") continue;
      for (const clip of track.clips.filter(isVideoClip)) {
        yield clip;
      }
    }
  }
}
