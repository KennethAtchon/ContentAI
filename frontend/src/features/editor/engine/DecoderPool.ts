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
import { debugLog } from "@/shared/utils/debug/debug.ts";

/** How far ahead/behind the playhead we keep decoders warm. */
const DEFAULT_DECODE_WINDOW_MS = 5_000;
const MAX_DEMUX_METADATA_CACHE_ENTRIES = 3;
const LOG_COMPONENT = "DecoderPool";

export interface DecodedFrame {
  frame: VideoFrame;
  timestampUs: number;
  clipId: string;
}

export interface DecoderPoolMetrics {
  activeDecoderCount: number;
  maxActiveDecoderCount: number;
  decodeWindowMs: number;
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
  private decodeWindowMs = DEFAULT_DECODE_WINDOW_MS;
  private maxActiveDecoderCount = MAX_ACTIVE_VIDEO_WORKERS;

  constructor(private readonly onFrame: FrameCallback) {
    this.logDebug("Initialized decoder pool", {
      decodeWindowMs: this.decodeWindowMs,
      maxActiveDecoderCount: this.maxActiveDecoderCount,
    });
  }

  private logDebug(
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ): void {
    debugLog.debug(message, { component: LOG_COMPONENT, ...context }, data);
  }

  private logWarn(
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ): void {
    debugLog.warn(message, { component: LOG_COMPONENT, ...context }, data);
  }

  private logError(
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ): void {
    debugLog.error(message, { component: LOG_COMPONENT, ...context }, data);
  }

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
    this.logDebug("Reconciling decoder workers", {
      playheadMs,
      trackCount: tracks.length,
      assetUrlCount: assetUrlMap.size,
      activeWorkersBefore: this.workers.size,
    });

    const { activeClipIds, candidates } = this.collectDecodeCandidates(
      tracks,
      assetUrlMap,
      playheadMs
    );
    const permittedClipIds = this.pickPermittedClipIds(candidates);

    this.ensureWorkersForCandidates(candidates, permittedClipIds, playheadMs);
    this.destroyWorkersOutsideSet(activeClipIds, permittedClipIds);

    this.logDebug("Finished worker reconciliation", {
      playheadMs,
      activeClipCount: activeClipIds.size,
      candidateCount: candidates.length,
      permittedCount: permittedClipIds.size,
      activeWorkersAfter: this.workers.size,
    });
  }

  /**
   * Sends a source-time seek to one worker. If the worker is loading or already
   * seeking, the newest seek is remembered and applied when ready.
   */
  seek(clipId: string, sourceTimeMs: number): void {
    const entry = this.workers.get(clipId);
    if (!entry) {
      this.logDebug("Ignored seek for inactive clip", { clipId, sourceTimeMs });
      return;
    }

    const seekToken = this.nextSeekToken(entry);
    entry.playAfterSeek = this.isPlaying;
    this.logDebug("Received seek request", {
      clipId,
      sourceTimeMs,
      seekToken,
      ready: entry.ready,
      seeking: entry.seeking,
      playAfterSeek: entry.playAfterSeek,
    });

    if (!entry.ready || entry.seeking) {
      entry.pendingSeek = { targetMs: sourceTimeMs, seekToken };
      this.logDebug("Queued pending seek", {
        clipId,
        sourceTimeMs,
        seekToken,
        reason: !entry.ready ? "not-ready" : "seek-in-flight",
      });
      return;
    }

    this.dispatchSeek(entry, sourceTimeMs, seekToken);
  }

  /**
   * Realigns every active video decoder to its source time for the timeline
   * playhead. Use after scrubs or timeline changes.
   */
  seekAll(tracks: Track[], playheadMs: number): void {
    this.logDebug("Seeking all active decoders", {
      playheadMs,
      workerCount: this.workers.size,
    });

    let seekCount = 0;
    for (const clip of this.iterVideoClips(tracks)) {
      if (!this.workers.has(clip.id)) continue;
      this.seek(clip.id, this.getClipSourceTimeMs(clip, playheadMs));
      seekCount += 1;
    }

    this.logDebug("Completed seekAll dispatch", {
      playheadMs,
      seekCount,
    });
  }

  play(): void {
    this.isPlaying = true;
    this.logDebug("Entering play mode", { workerCount: this.workers.size });

    for (const entry of this.workers.values()) {
      if (!entry.ready || entry.seeking) {
        entry.playAfterSeek = true;
        this.logDebug("Deferred PLAY until seek/ready", {
          clipId: entry.clipId,
          ready: entry.ready,
          seeking: entry.seeking,
        });
        continue;
      }

      entry.worker.postMessage({ type: "PLAY" });
      this.logDebug("Posted PLAY to worker", { clipId: entry.clipId });
    }
  }

  pause(): void {
    this.isPlaying = false;
    this.logDebug("Entering pause mode", { workerCount: this.workers.size });

    for (const entry of this.workers.values()) {
      entry.playAfterSeek = false;
      entry.worker.postMessage({ type: "PAUSE" });
      this.logDebug("Posted PAUSE to worker", { clipId: entry.clipId });
    }
  }

  setResourceBudget(budget: {
    decodeWindowMs: number;
    maxActiveDecoderCount: number;
  }): void {
    const previousBudget = {
      decodeWindowMs: this.decodeWindowMs,
      maxActiveDecoderCount: this.maxActiveDecoderCount,
    };

    this.decodeWindowMs = Math.max(500, Math.round(budget.decodeWindowMs));
    this.maxActiveDecoderCount = Math.max(
      1,
      Math.min(
        MAX_ACTIVE_VIDEO_WORKERS,
        Math.round(budget.maxActiveDecoderCount)
      )
    );

    this.logDebug("Updated decoder resource budget", {
      previousDecodeWindowMs: previousBudget.decodeWindowMs,
      previousMaxActiveDecoderCount: previousBudget.maxActiveDecoderCount,
      decodeWindowMs: this.decodeWindowMs,
      maxActiveDecoderCount: this.maxActiveDecoderCount,
      requestedDecodeWindowMs: budget.decodeWindowMs,
      requestedMaxActiveDecoderCount: budget.maxActiveDecoderCount,
    });
  }

  destroy(): void {
    this.logDebug("Destroying decoder pool", {
      workerCount: this.workers.size,
      metadataWaiterAssets: this.metadataWaiters.size,
      metadataLoadsInFlight: this.metadataLoadsInFlight.size,
    });

    for (const clipId of Array.from(this.workers.keys())) {
      this.destroyWorker(clipId);
    }
    this.workers.clear();
    this.metadataWaiters.clear();
    this.metadataLoadsInFlight.clear();

    this.logDebug("Decoder pool destroyed");
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

    const metrics: DecoderPoolMetrics = {
      activeDecoderCount: this.workers.size,
      maxActiveDecoderCount: this.maxActiveDecoderCount,
      decodeWindowMs: this.decodeWindowMs,
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

    this.logDebug("Collected decoder pool metrics", {
      activeDecoderCount: metrics.activeDecoderCount,
      readyDecoderCount: metrics.readyDecoderCount,
      seekingDecoderCount: metrics.seekingDecoderCount,
      pendingSeekCount: metrics.pendingSeekCount,
      metadataCacheEntries: metrics.metadataCache.entryCount,
    });

    return metrics;
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
      if (!assetUrl) {
        this.logDebug("Skipped clip with missing asset URL", {
          clipId: clip.id,
          assetId: clip.assetId ?? null,
        });
        continue;
      }
      if (this.isAssetCoolingDown(assetUrl, now)) {
        this.logDebug("Skipped candidate due to asset cooldown", {
          clipId: clip.id,
          assetUrl,
        });
        continue;
      }

      candidates.push({
        clip,
        assetUrl,
        priority: getClipDecodePriority(clip, playheadMs),
      });
    }

    candidates.sort((a, b) => a.priority - b.priority);
    this.logDebug("Collected decode candidates", {
      playheadMs,
      activeClipCount: activeClipIds.size,
      candidateCount: candidates.length,
    });
    return { activeClipIds, candidates };
  }

  private pickPermittedClipIds(candidates: DecodeCandidate[]): Set<string> {
    const permittedClipIds = new Set<string>();
    const perAssetCounts = new Map<string, number>();

    for (const { clip, assetUrl } of candidates) {
      if (permittedClipIds.size >= this.maxActiveDecoderCount) {
        this.logDebug("Reached global decoder worker cap", {
          maxActiveDecoderCount: this.maxActiveDecoderCount,
          rejectedClipId: clip.id,
        });
        break;
      }

      const assetCount = perAssetCounts.get(assetUrl) ?? 0;
      if (assetCount >= MAX_WORKERS_PER_ASSET_URL) {
        this.logDebug("Skipped clip due to per-asset worker cap", {
          clipId: clip.id,
          assetUrl,
          maxWorkersPerAssetUrl: MAX_WORKERS_PER_ASSET_URL,
        });
        continue;
      }

      permittedClipIds.add(clip.id);
      perAssetCounts.set(assetUrl, assetCount + 1);
    }

    this.logDebug("Selected permitted clip IDs", {
      candidateCount: candidates.length,
      permittedCount: permittedClipIds.size,
    });
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
      if (existing?.assetUrl === assetUrl) {
        this.logDebug("Reused existing worker", {
          clipId: clip.id,
          assetUrl,
        });
        continue;
      }

      // Recreate on URL changes so the worker never decodes from a stale asset.
      this.logDebug("Creating/replacing worker for candidate", {
        clipId: clip.id,
        assetUrl,
        hadExistingWorker: Boolean(existing),
      });
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
        this.logDebug("Destroying worker outside active/permitted sets", {
          clipId,
          isActive: activeClipIds.has(clipId),
          isPermitted: permittedClipIds.has(clipId),
        });
        this.destroyWorker(clipId);
      }
    }
  }

  private createWorker(
    clip: VideoClip,
    assetUrl: string,
    initialSourceTimeMs: number
  ): void {
    this.logDebug("Creating clip decode worker", {
      clipId: clip.id,
      assetUrl,
      initialSourceTimeMs,
    });

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
    this.logDebug("Worker entry registered", {
      clipId: clip.id,
      assetUrl,
      activeWorkers: this.workers.size,
    });
    this.startWorkerLoad(entry);
  }

  private createWorkerEntry(
    worker: Worker,
    clipId: string,
    assetUrl: string,
    initialSourceTimeMs: number
  ): WorkerEntry {
    const entry: WorkerEntry = {
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

    this.logDebug("Created worker entry state", {
      clipId,
      assetUrl,
      pendingSeekToken: entry.pendingSeek?.seekToken ?? null,
      pendingSeekTargetMs: entry.pendingSeek?.targetMs ?? null,
      playAfterSeek: entry.playAfterSeek,
    });

    return entry;
  }

  private destroyWorker(clipId: string): void {
    const entry = this.workers.get(clipId);
    if (!entry) {
      this.logDebug("Skipped destroy for missing worker", { clipId });
      return;
    }

    this.logDebug("Destroying worker", {
      clipId,
      assetUrl: entry.assetUrl,
      metadataLoader: entry.metadataLoader,
      seeking: entry.seeking,
      hasPendingSeek: entry.pendingSeek !== null,
    });

    entry.destroyed = true;
    if (entry.terminateTimer !== null) {
      clearTimeout(entry.terminateTimer);
      this.logDebug("Cleared pending terminate timer", { clipId });
    }

    this.releaseMetadataOwnership(entry);
    entry.worker.postMessage({ type: "DESTROY" });
    // Worker does its own cleanup first; terminate is the fallback if it hangs.
    entry.terminateTimer = window.setTimeout(
      () => entry.worker.terminate(),
      200
    );
    this.workers.delete(clipId);
    this.logDebug("Worker destroy dispatched", {
      clipId,
      activeWorkers: this.workers.size,
    });
  }

  // ---------------------------------------------------------------------------
  // Worker messages
  // ---------------------------------------------------------------------------

  private handleWorkerMessage(
    entry: WorkerEntry,
    message: ClipDecodeWorkerMessage
  ): void {
    this.logDebug("Received worker message", {
      clipId: entry.clipId,
      type: message.type,
      destroyed: entry.destroyed,
    });

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
    if (message.assetUrl !== entry.assetUrl) {
      this.logWarn("Ignored METADATA_READY with mismatched asset URL", {
        clipId: entry.clipId,
        expectedAssetUrl: entry.assetUrl,
        messageAssetUrl: message.assetUrl,
      });
      return;
    }

    entry.metadataLoader = false;
    this.metadataLoadsInFlight.delete(entry.assetUrl);
    this.rememberMetadata(entry.assetUrl, message.metadata);
    this.releaseMetadataWaiters(entry.assetUrl, message.metadata);
    this.logDebug("Processed METADATA_READY", {
      clipId: entry.clipId,
      assetUrl: entry.assetUrl,
      metadataCacheSize: this.metadataCache.size,
    });
  }

  private handleWorkerReady(entry: WorkerEntry): void {
    entry.ready = true;
    this.logDebug("Worker is READY", {
      clipId: entry.clipId,
      hasPendingSeek: entry.pendingSeek !== null,
      isPlaying: this.isPlaying,
    });

    if (entry.pendingSeek !== null) {
      this.dispatchPendingSeek(entry);
      return;
    }

    if (this.isPlaying) {
      entry.worker.postMessage({ type: "PLAY" });
      this.logDebug("Posted PLAY after READY", { clipId: entry.clipId });
    }
  }

  private handleDecodedFrame(
    entry: WorkerEntry,
    message: Extract<ClipDecodeWorkerMessage, { type: "FRAME" }>
  ): void {
    if (this.shouldDropFrame(entry, message.seekToken ?? null)) {
      entry.seekMetrics.staleFrameDropCount += 1;
      this.logDebug("Dropped stale decoded frame", {
        clipId: entry.clipId,
        seekToken: message.seekToken ?? null,
        latestRequestedSeekToken: entry.latestRequestedSeekToken,
        activeSeekToken: entry.activeSeekToken,
        staleFrameDropCount: entry.seekMetrics.staleFrameDropCount,
      });
      message.frame.close();
      return;
    }

    entry.seekMetrics.acceptedFrameCount += 1;
    this.recordFirstAcceptedSeekFrame(entry);
    this.logDebug("Accepted decoded frame", {
      clipId: entry.clipId,
      timestampUs: message.timestampUs,
      seekToken: message.seekToken ?? null,
      acceptedFrameCount: entry.seekMetrics.acceptedFrameCount,
    });
    this.onFrame({
      frame: message.frame,
      timestampUs: message.timestampUs,
      clipId: message.clipId,
    });
  }

  private handleSeekDone(entry: WorkerEntry, seekToken: number | null): void {
    if (seekToken !== entry.activeSeekToken) {
      this.logDebug("Ignored SEEK_DONE for stale token", {
        clipId: entry.clipId,
        seekToken,
        activeSeekToken: entry.activeSeekToken,
      });
      return;
    }

    this.logDebug("Processed SEEK_DONE", {
      clipId: entry.clipId,
      seekToken,
      hasPendingSeek: entry.pendingSeek !== null,
      playAfterSeek: entry.playAfterSeek,
      isPlaying: this.isPlaying,
    });

    if (entry.pendingSeek !== null) {
      this.dispatchPendingSeek(entry);
      return;
    }

    entry.seeking = false;
    entry.activeSeekToken = null;

    if (entry.playAfterSeek && this.isPlaying) {
      entry.playAfterSeek = false;
      entry.worker.postMessage({ type: "PLAY" });
      this.logDebug("Posted PLAY after seek completion", { clipId: entry.clipId });
    }
  }

  private handleSeekFailed(
    entry: WorkerEntry,
    message: Extract<ClipDecodeWorkerMessage, { type: "SEEK_FAILED" }>
  ): void {
    if ((message.seekToken ?? null) !== entry.activeSeekToken) {
      this.logDebug("Ignored SEEK_FAILED for stale token", {
        clipId: entry.clipId,
        seekToken: message.seekToken ?? null,
        activeSeekToken: entry.activeSeekToken,
      });
      return;
    }

    this.logWarn("Worker reported SEEK_FAILED", {
      clipId: entry.clipId,
      seekToken: message.seekToken ?? null,
      message: message.message,
    });

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
    this.logError("Worker reported ERROR", {
      clipId: entry.clipId,
      message: message.message,
    });
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
    this.logDebug("Recorded first accepted frame latency", {
      clipId: entry.clipId,
      latencyMs: entry.seekMetrics.lastFirstAcceptedFrameMs,
      targetMs: entry.seekMetrics.lastTargetMs,
    });
  }

  private closeFrameFromDestroyedEntry(message: ClipDecodeWorkerMessage): void {
    if (message.type === "FRAME") {
      this.logDebug("Closing frame from destroyed entry", {
        clipId: message.clipId,
        timestampUs: message.timestampUs,
      });
      message.frame.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Seeking
  // ---------------------------------------------------------------------------

  private nextSeekToken(entry: WorkerEntry): number {
    entry.latestRequestedSeekToken += 1;
    this.logDebug("Allocated next seek token", {
      clipId: entry.clipId,
      seekToken: entry.latestRequestedSeekToken,
    });
    return entry.latestRequestedSeekToken;
  }

  private dispatchPendingSeek(entry: WorkerEntry): void {
    if (!entry.pendingSeek) {
      this.logDebug("No pending seek to dispatch", { clipId: entry.clipId });
      return;
    }

    this.logDebug("Dispatching pending seek", {
      clipId: entry.clipId,
      targetMs: entry.pendingSeek.targetMs,
      seekToken: entry.pendingSeek.seekToken,
    });
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
    this.logDebug("Posting SEEK to worker", {
      clipId: entry.clipId,
      sourceTimeMs,
      seekToken,
      playAfterSeek: entry.playAfterSeek,
    });
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
      this.logDebug("Starting LOAD with cached metadata", {
        clipId: entry.clipId,
        assetUrl: entry.assetUrl,
      });
      this.postLoad(entry, cachedMetadata);
      return;
    }

    if (this.metadataLoadsInFlight.has(entry.assetUrl)) {
      // Another clip is already demuxing this asset. Wait and then LOAD with
      // cached metadata instead of making every worker parse the same MP4.
      this.logDebug("Waiting for in-flight metadata load", {
        clipId: entry.clipId,
        assetUrl: entry.assetUrl,
      });
      this.addMetadataWaiter(entry);
      return;
    }

    this.metadataLoadsInFlight.add(entry.assetUrl);
    entry.metadataLoader = true;
    this.logDebug("Starting fresh metadata load", {
      clipId: entry.clipId,
      assetUrl: entry.assetUrl,
    });
    this.postLoad(entry);
  }

  private postLoad(entry: WorkerEntry, metadata?: CachedDemuxMetadata): void {
    this.logDebug("Posting LOAD to worker", {
      clipId: entry.clipId,
      assetUrl: entry.assetUrl,
      usesCachedMetadata: Boolean(metadata),
    });
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
    this.logDebug("Added metadata waiter", {
      clipId: entry.clipId,
      assetUrl: entry.assetUrl,
      waiterCount: waiters.size,
    });
  }

  private getCachedMetadata(assetUrl: string): CachedDemuxMetadata | null {
    const entry = this.metadataCache.get(assetUrl);
    if (!entry) {
      this.logDebug("Metadata cache miss", { assetUrl });
      return null;
    }

    entry.lastUsedAtMs = performance.now();
    this.logDebug("Metadata cache hit", { assetUrl });
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
    this.logDebug("Cached demux metadata", {
      assetUrl,
      cacheSize: this.metadataCache.size,
    });
    this.evictOldMetadataIfNeeded();
  }

  private evictOldMetadataIfNeeded(): void {
    if (this.metadataCache.size <= MAX_DEMUX_METADATA_CACHE_ENTRIES) {
      return;
    }

    let oldestAssetUrl: string | null = null;
    let oldestUsedAtMs = Number.POSITIVE_INFINITY;

    for (const [assetUrl, entry] of this.metadataCache) {
      if (entry.lastUsedAtMs >= oldestUsedAtMs) continue;
      oldestAssetUrl = assetUrl;
      oldestUsedAtMs = entry.lastUsedAtMs;
    }

    if (oldestAssetUrl) {
      this.metadataCache.delete(oldestAssetUrl);
      this.logDebug("Evicted oldest metadata cache entry", {
        assetUrl: oldestAssetUrl,
        cacheSize: this.metadataCache.size,
      });
    }
  }

  private releaseMetadataWaiters(
    assetUrl: string,
    metadata: CachedDemuxMetadata | null
  ): void {
    const waiters = this.metadataWaiters.get(assetUrl);
    if (!waiters) {
      this.logDebug("No metadata waiters to release", { assetUrl });
      return;
    }

    this.metadataWaiters.delete(assetUrl);
    const liveWaiters = [...waiters].filter(
      (waiter) => !waiter.destroyed && this.workers.has(waiter.clipId)
    );
    this.logDebug("Releasing metadata waiters", {
      assetUrl,
      waiterCount: waiters.size,
      liveWaiterCount: liveWaiters.length,
      hasMetadata: Boolean(metadata),
    });

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
    if (!loader) {
      this.logWarn("No live waiter available to promote", { assetUrl });
      return;
    }

    // If the metadata loader was destroyed before finishing, choose one waiter
    // to become the new loader and keep the rest waiting.
    this.metadataLoadsInFlight.add(loader.assetUrl);
    loader.metadataLoader = true;
    this.logDebug("Promoted waiter to metadata loader", {
      assetUrl,
      clipId: loader.clipId,
      remainingWaiterCount: remainingWaiters.length,
    });
    this.postLoad(loader);

    if (remainingWaiters.length > 0) {
      this.metadataWaiters.set(assetUrl, new Set(remainingWaiters));
    }
  }

  private releaseMetadataOwnership(entry: WorkerEntry): void {
    if (entry.metadataLoader) {
      entry.metadataLoader = false;
      this.metadataLoadsInFlight.delete(entry.assetUrl);
      this.logDebug("Released metadata loader ownership", {
        clipId: entry.clipId,
        assetUrl: entry.assetUrl,
      });
      this.releaseMetadataWaiters(entry.assetUrl, null);
    }

    const waiters = this.metadataWaiters.get(entry.assetUrl);
    if (!waiters) return;

    waiters.delete(entry);
    this.logDebug("Removed worker from metadata waiters", {
      clipId: entry.clipId,
      assetUrl: entry.assetUrl,
      remainingWaiters: waiters.size,
    });
    if (waiters.size === 0) {
      this.metadataWaiters.delete(entry.assetUrl);
    }
  }

  private destroyMetadataWaiters(assetUrl: string): void {
    const waiters = this.metadataWaiters.get(assetUrl);
    if (!waiters) {
      this.logDebug("No metadata waiters to destroy", { assetUrl });
      return;
    }

    this.metadataWaiters.delete(assetUrl);
    this.logWarn("Destroying metadata waiters after loader failure", {
      assetUrl,
      waiterCount: waiters.size,
    });

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
    const blockedUntil = Date.now() + DECODE_FAILURE_COOLDOWN_MS;
    this.assetFailuresUntil.set(
      entry.assetUrl,
      blockedUntil
    );
    this.logWarn("Applied asset decode cooldown", {
      clipId: entry.clipId,
      assetUrl: entry.assetUrl,
      blockedUntil,
      cooldownMs: DECODE_FAILURE_COOLDOWN_MS,
    });

    if (entry.metadataLoader) {
      entry.metadataLoader = false;
      this.metadataLoadsInFlight.delete(entry.assetUrl);
      this.destroyMetadataWaiters(entry.assetUrl);
    }

    this.logError(prefix, {
      clipId: entry.clipId,
      assetUrl: entry.assetUrl,
    }, error);
    this.destroyWorker(entry.clipId);
  }

  private isAssetCoolingDown(assetUrl: string, now: number): boolean {
    const blockedUntil = this.assetFailuresUntil.get(assetUrl);
    if (!blockedUntil) return false;

    if (blockedUntil <= now) {
      this.assetFailuresUntil.delete(assetUrl);
      this.logDebug("Asset cooldown expired", { assetUrl });
      return false;
    }

    this.logDebug("Asset still cooling down", {
      assetUrl,
      blockedForMs: blockedUntil - now,
    });
    return true;
  }

  private isClipInDecodeWindow(clip: VideoClip, playheadMs: number): boolean {
    const clipEnd = clip.startMs + clip.durationMs;
    return (
      playheadMs >= clip.startMs - this.decodeWindowMs &&
      playheadMs <= clipEnd + this.decodeWindowMs
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
