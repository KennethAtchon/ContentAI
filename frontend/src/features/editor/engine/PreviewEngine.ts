import {
  AudioMixer,
  buildAudioClipDescriptors,
  type AudioClipDescriptor,
} from "./AudioMixer";
import { DecoderPool, type DecoderPoolMetrics } from "./DecoderPool";
import {
  buildCompositorDescriptorsWithRust,
  preloadEditorCoreWasm,
} from "./editor-core-wasm";
import type {
  CompositorClipDescriptor,
  CompositorClipPath,
  CompositorClipTransform,
  CompositorPreviewQuality,
  SerializedCaptionFrame,
  SerializedTextObject,
} from "./CompositorWorker";
import { IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";
import { systemPerformance } from "@/shared/utils/system/performance";
import type { TextClip, Track, VideoClip } from "../types/editor";
import { isTextClip, isVideoClip } from "../utils/clip-types";
import { getClipSourceTimeSecondsAtTimelineTime } from "../utils/editor-composition";
import { getTextClipPreviewDisplay } from "../utils/text-segments";
import type { Transition } from "../types/editor";

const REACT_PUBLISH_INTERVAL_MS = 250;
const DECODER_RECONCILE_INTERVAL_MS = 500;
const SCRUB_QUALITY_IDLE_RESTORE_MS = 220;
const DROPPED_FRAME_DEGRADE_THRESHOLD = 3;
const STABLE_FRAME_RECOVERY_THRESHOLD = 90;
const MEMORY_PRESSURE_CHECK_INTERVAL_MS = 1_000;

export type PreviewQualityLevel = "full" | "half" | "low";
type PreviewQualityReason = "steady" | "scrubbing" | "dropped-frames";
type DecoderBudgetReason = "steady" | "memory-pressure";

export interface PreviewQualityState extends CompositorPreviewQuality {
  disableEffects: boolean;
  reason: PreviewQualityReason;
}

const PREVIEW_QUALITY: Record<PreviewQualityLevel, PreviewQualityState> = {
  full: {
    level: "full",
    scale: 1,
    disableEffects: false,
    reason: "steady",
  },
  half: {
    level: "half",
    scale: 0.5,
    disableEffects: false,
    reason: "scrubbing",
  },
  low: {
    level: "low",
    scale: 0.35,
    disableEffects: true,
    reason: "dropped-frames",
  },
};

const DECODER_BUDGETS: Record<
  DecoderBudgetReason,
  { decodeWindowMs: number; maxActiveDecoderCount: number }
> = {
  steady: { decodeWindowMs: 5_000, maxActiveDecoderCount: 4 },
  "memory-pressure": { decodeWindowMs: 2_000, maxActiveDecoderCount: 2 },
};

export interface SeekLatencyMetrics {
  seekId: number;
  targetMs: number;
  requestedAtMs: number;
  firstDecodedFrameMs: number | null;
  firstCompositorTickMs: number | null;
  reactPublishMs: number | null;
}

export interface PreviewEngineMetrics {
  seekCount: number;
  decodedFrameCount: number;
  droppedFrameCount: number;
  compositorFrameMs: number;
  reactPublishMs: number;
  audioClockDriftMs: number;
  decoderBudgetReason: DecoderBudgetReason;
  previewQuality: PreviewQualityState;
  lastSeekLatency: SeekLatencyMetrics | null;
  decoderPool: DecoderPoolMetrics;
}

type PreviewEngineMetricState = Omit<PreviewEngineMetrics, "decoderPool">;

export interface EffectPreviewPatch {
  clipId: string;
  patch: Partial<VideoClip>;
}

export interface PreviewEngineCallbacks {
  onTimeUpdate(ms: number, reason: "raf" | "pause" | "playback-end"): void;
  onPlaybackEnd(): void;
  onFrame(frame: VideoFrame, timestampUs: number, clipId: string): void;
  onTick(
    playheadMs: number,
    clips: CompositorClipDescriptor[],
    textObjects: SerializedTextObject[],
    quality: CompositorPreviewQuality,
    /**
     * `SerializedCaptionFrame` — new bitmap to transfer to the compositor.
     * `null`                   — explicit clear (seek, clip change).
     * `undefined`              — no change; compositor keeps its current caption.
     */
    captionFrame?: SerializedCaptionFrame | null
  ): void;
  onClearFrames(clipIds: string[]): void;
  /**
   * Called once per RAF tick, before the compositor tick.
   * Use this to drive caption re-renders at the audio-clock time.
   * NOT called from `renderCurrentFrame()` — only from the live RAF loop.
   */
  onRenderTick?(playheadMs: number): void;
}

const DEFAULT_COMPOSITOR_TRANSFORM: CompositorClipTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  translateXPercent: 0,
  translateYPercent: 0,
  rotationDeg: 0,
};

function buildBaseTransform(
  clip: VideoClip,
  previewPatch: Partial<VideoClip> | null
): CompositorClipTransform {
  return {
    scale: previewPatch?.scale ?? clip.scale ?? 1,
    translateX: previewPatch?.positionX ?? clip.positionX ?? 0,
    translateY: previewPatch?.positionY ?? clip.positionY ?? 0,
    translateXPercent: 0,
    translateYPercent: 0,
    rotationDeg: previewPatch?.rotation ?? clip.rotation ?? 0,
  };
}

function getOutgoingTransitionDescriptor(
  clip: VideoClip,
  transitions: Transition[],
  timelineMs: number
): { opacity?: number; transform?: Partial<CompositorClipTransform> } {
  const transition = transitions.find((item) => item.clipAId === clip.id);
  if (!transition || transition.type === "none") return {};

  const clipEnd = clip.startMs + clip.durationMs;
  const windowStart = clipEnd - transition.durationMs;
  if (timelineMs < windowStart || timelineMs > clipEnd) return {};

  const progress = (timelineMs - windowStart) / transition.durationMs;

  switch (transition.type) {
    case "fade":
    case "dissolve":
      return { opacity: 1 - progress };
    case "slide-left":
      return { transform: { translateXPercent: -progress * 100 } };
    case "slide-up":
      return { transform: { translateYPercent: -progress * 100 } };
    default:
      return {};
  }
}

function getIncomingTransitionDescriptor(
  clip: VideoClip,
  transitions: Transition[],
  allClips: VideoClip[],
  timelineMs: number
): { opacity?: number; clipPath?: CompositorClipPath } | null {
  const transition = transitions.find((item) => item.clipBId === clip.id);
  if (
    !transition ||
    (transition.type !== "dissolve" && transition.type !== "wipe-right")
  ) {
    return null;
  }

  const clipA = allClips.find((item) => item.id === transition.clipAId);
  if (!clipA) return null;

  const clipAEnd = clipA.startMs + clipA.durationMs;
  const windowStart = clipAEnd - transition.durationMs;
  if (timelineMs < windowStart || timelineMs > clipAEnd) return null;

  const progress = (timelineMs - windowStart) / transition.durationMs;

  if (transition.type === "dissolve") {
    return { opacity: progress };
  }
  return {
    clipPath: {
      type: "inset",
      top: 0,
      right: (1 - progress) * 100,
      bottom: 0,
      left: 0,
    },
    opacity: 1,
  };
}

export function buildCompositorClips(
  tracks: Track[],
  timelineMs: number,
  effectPreview: EffectPreviewPatch | null
): CompositorClipDescriptor[] {
  const clips: CompositorClipDescriptor[] = [];
  const videoTracks = tracks.filter((track) => track.type === "video");

  for (let trackIndex = 0; trackIndex < videoTracks.length; trackIndex += 1) {
    const track = videoTracks[trackIndex];
    const videoClips = track.clips.filter(isVideoClip);
    const trackTransitions = track.transitions ?? [];

    for (const clip of videoClips) {
      const previewPatch =
        effectPreview?.clipId === clip.id ? effectPreview.patch : null;
      const contrast = previewPatch?.contrast ?? clip.contrast;
      const warmth = previewPatch?.warmth ?? clip.warmth;
      const baseOpacity = previewPatch?.opacity ?? clip.opacity ?? 1;

      const outgoing = getOutgoingTransitionDescriptor(
        clip,
        trackTransitions,
        timelineMs
      );
      const incoming = getIncomingTransitionDescriptor(
        clip,
        trackTransitions,
        videoClips,
        timelineMs
      );

      const isActive =
        timelineMs >= clip.startMs &&
        timelineMs < clip.startMs + clip.durationMs;

      let opacity: number;
      if (clip.enabled === false) {
        opacity = 0;
      } else if (typeof outgoing.opacity === "number") {
        opacity = outgoing.opacity;
      } else if (typeof incoming?.opacity === "number") {
        opacity = incoming.opacity;
      } else {
        opacity = isActive ? baseOpacity : 0;
      }

      const transform = {
        ...DEFAULT_COMPOSITOR_TRANSFORM,
        ...buildBaseTransform(clip, previewPatch),
        ...(outgoing.transform ?? {}),
      };

      clips.push({
        clipId: clip.id,
        zIndex: videoTracks.length - 1 - trackIndex,
        sourceTimeUs: Math.round(
          getClipSourceTimeSecondsAtTimelineTime(clip, timelineMs) * 1_000_000
        ),
        opacity,
        clipPath: incoming?.clipPath ?? null,
        effects: {
          contrast: contrast ?? 0,
          warmth: warmth ?? 0,
        },
        transform,
        enabled: clip.enabled !== false,
      });
    }
  }

  return clips;
}

function collectVideoClipIds(tracks: Track[]): string[] {
  return tracks
    .filter((track) => track.type === "video")
    .flatMap((track) => track.clips.filter(isVideoClip).map((clip) => clip.id));
}

export class PreviewEngine {
  private readonly audioMixer = new AudioMixer();
  private readonly decoderPool: DecoderPool;
  private readonly callbacks: PreviewEngineCallbacks;

  private rafHandle: number | null = null;
  private isPlaying = false;
  private currentTimeMs = 0;
  private durationMs = 0;
  private lastPublishMs = Number.NEGATIVE_INFINITY;
  private lastDecoderReconcileMs = Number.NEGATIVE_INFINITY;
  private playRequestToken = 0;
  private rafStartWallMs = 0;
  private rafStartTimelineMs = 0;
  private lastAudibleTickMs: number | null = null;
  private didLogMetricsForCurrentSession = false;
  private seekSequence = 0;
  private activeSeekLatency: SeekLatencyMetrics | null = null;
  private unregisterDebugProvider: (() => void) | null = null;
  private canvasWidth: number;
  private canvasHeight: number;
  private fps: number;
  private tracks: Track[] = [];
  private assetUrlMap = new Map<string, string>();
  private effectPreview: EffectPreviewPatch | null = null;
  private pendingCaptionFrame: SerializedCaptionFrame | null | undefined =
    undefined;
  private previewQuality: PreviewQualityState = PREVIEW_QUALITY.full;
  private scrubQualityRestoreTimer: number | null = null;
  private droppedFramePressureCount = 0;
  private stableFrameCount = 0;
  private decoderBudgetReason: DecoderBudgetReason = "steady";
  private lastMemoryPressureCheckMs = Number.NEGATIVE_INFINITY;
  private metrics: PreviewEngineMetricState = {
    seekCount: 0,
    decodedFrameCount: 0,
    droppedFrameCount: 0,
    compositorFrameMs: 0,
    reactPublishMs: 0,
    audioClockDriftMs: 0,
    decoderBudgetReason: "steady",
    previewQuality: PREVIEW_QUALITY.full,
    lastSeekLatency: null,
  };

  static async create(
    callbacks: PreviewEngineCallbacks,
    options: { canvasWidth: number; canvasHeight: number; fps: number }
  ): Promise<PreviewEngine> {
    await preloadEditorCoreWasm();
    return new PreviewEngine(callbacks, options);
  }

  constructor(
    callbacks: PreviewEngineCallbacks,
    options: { canvasWidth: number; canvasHeight: number; fps: number }
  ) {
    this.callbacks = callbacks;
    this.canvasWidth = options.canvasWidth;
    this.canvasHeight = options.canvasHeight;
    this.fps = options.fps;
    this.decoderPool = new DecoderPool(({ frame, timestampUs, clipId }) => {
      this.metrics.decodedFrameCount += 1;
      this.markFirstDecodedFrameAfterSeek(clipId, timestampUs);
      this.callbacks.onFrame(frame, timestampUs, clipId);
    });
    this.unregisterDebugProvider = systemPerformance.registerSnapshotProvider(
      "previewEngine",
      () => this.getDebugSnapshot()
    );
  }

  async primeAudioContext(): Promise<void> {
    await this.audioMixer.prime();
  }

  update(
    tracks: Track[],
    assetUrlMap: Map<string, string>,
    durationMs: number,
    effectPreview: EffectPreviewPatch | null,
    dimensions?: { canvasWidth: number; canvasHeight: number; fps: number }
  ): void {
    this.tracks = tracks;
    this.assetUrlMap = assetUrlMap;
    this.durationMs = durationMs;
    this.effectPreview = effectPreview;
    if (dimensions) {
      this.canvasWidth = dimensions.canvasWidth;
      this.canvasHeight = dimensions.canvasHeight;
      this.fps = dimensions.fps;
    }

    for (const track of tracks) {
      if (
        track.type === "video" ||
        track.type === "audio" ||
        track.type === "music"
      ) {
        this.audioMixer.setTrackMute(track.id, track.muted);
      }
    }

    this.observeMemoryPressure();
    this.decoderPool.update(tracks, assetUrlMap, this.currentTimeMs);
    this.tickCompositor(this.currentTimeMs);
  }

  async play(): Promise<void> {
    if (this.isPlaying) return;
    const requestToken = this.playRequestToken + 1;
    this.playRequestToken = requestToken;
    this.resetSessionMetrics();
    this.setPreviewQuality("full", "steady");
    this.isPlaying = true;
    await this.audioMixer.play(
      this.currentTimeMs,
      this.buildAudioClipDescriptors()
    );
    if (!this.isPlaying || requestToken !== this.playRequestToken) return;
    this.decoderPool.update(this.tracks, this.assetUrlMap, this.currentTimeMs);
    this.decoderPool.seekAll(this.tracks, this.currentTimeMs);
    this.decoderPool.play();
    this.lastPublishMs = Number.NEGATIVE_INFINITY;
    this.lastDecoderReconcileMs = this.currentTimeMs;
    this.startRafLoop();
  }

  pause(): void {
    this.playRequestToken += 1;
    if (!this.isPlaying) {
      this.tickCompositor(this.currentTimeMs);
      return;
    }

    this.stopRafLoop();
    this.decoderPool.pause();
    this.audioMixer.pause();
    this.currentTimeMs = this.clampTime(this.audioMixer.getAudibleTimeMs());
    this.isPlaying = false;
    this.tickCompositor(this.currentTimeMs);
    this.publishTimeUpdate(this.currentTimeMs, "pause");
    this.logMetricsIfDevelopment();
  }

  async seek(ms: number): Promise<void> {
    const targetMs = this.clampTime(ms);
    const wasPlaying = this.isPlaying;
    const requestToken = this.playRequestToken + 1;
    this.playRequestToken = requestToken;
    this.startSeekLatency(targetMs);
    this.setPreviewQuality("half", "scrubbing");
    this.scheduleScrubQualityRestore();

    this.stopRafLoop();
    this.decoderPool.pause();
    this.audioMixer.seek(targetMs);

    this.currentTimeMs = targetMs;
    this.metrics.seekCount += 1;

    const videoClipIds = collectVideoClipIds(this.tracks);
    if (videoClipIds.length > 0) {
      this.callbacks.onClearFrames(videoClipIds);
    }

    this.observeMemoryPressure();
    this.decoderPool.update(this.tracks, this.assetUrlMap, targetMs);
    this.decoderPool.seekAll(this.tracks, targetMs);
    this.tickCompositor(targetMs);

    if (wasPlaying) {
      await this.audioMixer.play(targetMs, this.buildAudioClipDescriptors());
      if (!this.isPlaying || requestToken !== this.playRequestToken) {
        return;
      }
      this.decoderPool.play();
      this.lastPublishMs = Number.NEGATIVE_INFINITY;
      this.lastDecoderReconcileMs = targetMs;
      this.startRafLoop();
      this.isPlaying = true;
      return;
    }

    this.isPlaying = false;
  }

  setCurrentTime(ms: number): void {
    this.currentTimeMs = this.clampTime(ms);
  }

  setCaptionFrame(captionFrame: SerializedCaptionFrame | null): void {
    if (this.pendingCaptionFrame && this.pendingCaptionFrame !== captionFrame) {
      this.pendingCaptionFrame.bitmap.close();
    }
    this.pendingCaptionFrame = captionFrame;
  }

  renderCurrentFrame(): void {
    this.tickCompositor(this.currentTimeMs);
  }

  getMetrics(): PreviewEngineMetrics {
    return {
      ...this.metrics,
      previewQuality: { ...this.metrics.previewQuality },
      lastSeekLatency: this.metrics.lastSeekLatency
        ? { ...this.metrics.lastSeekLatency }
        : null,
      decoderPool: this.decoderPool.getMetrics(),
    };
  }

  destroy(): void {
    this.stopRafLoop();
    this.clearScrubQualityRestoreTimer();
    this.decoderPool.destroy();
    this.audioMixer.destroy();
    this.unregisterDebugProvider?.();
    this.unregisterDebugProvider = null;
    if (this.pendingCaptionFrame) {
      this.pendingCaptionFrame.bitmap.close();
      this.pendingCaptionFrame = undefined;
    }
  }

  private buildAudioClipDescriptors(): AudioClipDescriptor[] {
    return buildAudioClipDescriptors(this.tracks, this.assetUrlMap);
  }

  private tickCompositor(playheadMs: number): void {
    const frameStart = performance.now();
    const timerId = systemPerformance.start("editor.compositorTick", {
      playheadMs,
    });
    const clips = buildCompositorDescriptorsWithRust(
      this.tracks,
      playheadMs,
      this.effectPreview
    );
    const previewClips = this.applyPreviewQualityToClips(clips);
    const textObjects = this.buildTextObjects(playheadMs);
    const captionFrame = this.pendingCaptionFrame;
    this.pendingCaptionFrame = undefined;
    this.callbacks.onTick(
      playheadMs,
      previewClips,
      textObjects,
      this.toCompositorQuality(),
      captionFrame
    );
    const measured = timerId
      ? systemPerformance.stop(timerId, {
          clipCount: previewClips.length,
          textObjectCount: textObjects.length,
          hasCaptionFrame: captionFrame !== undefined,
          previewQuality: this.previewQuality.level,
          previewQualityReason: this.previewQuality.reason,
        })
      : null;
    this.metrics.compositorFrameMs =
      measured?.durationMs ?? performance.now() - frameStart;
    this.markFirstCompositorTickAfterSeek(playheadMs);
  }

  private applyPreviewQualityToClips(
    clips: CompositorClipDescriptor[]
  ): CompositorClipDescriptor[] {
    if (!this.previewQuality.disableEffects) return clips;

    return clips.map((clip) => ({
      ...clip,
      effects: {
        contrast: 0,
        warmth: 0,
      },
    }));
  }

  private toCompositorQuality(): CompositorPreviewQuality {
    return {
      level: this.previewQuality.level,
      scale: this.previewQuality.scale,
    };
  }

  private setPreviewQuality(
    level: PreviewQualityLevel,
    reason: PreviewQualityReason
  ): void {
    const next = { ...PREVIEW_QUALITY[level], reason };
    if (
      this.previewQuality.level === next.level &&
      this.previewQuality.reason === next.reason
    ) {
      return;
    }

    this.previewQuality = next;
    this.metrics.previewQuality = next;
    systemPerformance.setDebugValue("editorPreviewQuality", next);
  }

  private scheduleScrubQualityRestore(): void {
    this.clearScrubQualityRestoreTimer();
    this.scrubQualityRestoreTimer = window.setTimeout(() => {
      this.scrubQualityRestoreTimer = null;
      if (this.previewQuality.reason !== "scrubbing") return;
      this.setPreviewQuality("full", "steady");
      if (!this.isPlaying) {
        this.tickCompositor(this.currentTimeMs);
      }
    }, SCRUB_QUALITY_IDLE_RESTORE_MS);
  }

  private clearScrubQualityRestoreTimer(): void {
    if (this.scrubQualityRestoreTimer == null) return;

    window.clearTimeout(this.scrubQualityRestoreTimer);
    this.scrubQualityRestoreTimer = null;
  }

  private observeFramePressure(droppedFrames: number): void {
    if (droppedFrames > 0) {
      this.stableFrameCount = 0;
      this.droppedFramePressureCount += 1;
      if (this.droppedFramePressureCount >= DROPPED_FRAME_DEGRADE_THRESHOLD) {
        this.setPreviewQuality("low", "dropped-frames");
      }
      return;
    }

    this.droppedFramePressureCount = 0;
    if (this.previewQuality.reason !== "dropped-frames") return;

    this.stableFrameCount += 1;
    if (this.stableFrameCount >= STABLE_FRAME_RECOVERY_THRESHOLD) {
      this.stableFrameCount = 0;
      this.setPreviewQuality("full", "steady");
    }
  }

  private observeMemoryPressure(): void {
    const now = performance.now();
    if (
      now - this.lastMemoryPressureCheckMs <
      MEMORY_PRESSURE_CHECK_INTERVAL_MS
    ) {
      return;
    }
    this.lastMemoryPressureCheckMs = now;

    const memory = (
      performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      }
    ).memory;
    if (!memory || memory.jsHeapSizeLimit <= 0) return;

    const pressureRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    const nextReason: DecoderBudgetReason =
      pressureRatio >= 0.75 ? "memory-pressure" : "steady";
    if (nextReason === this.decoderBudgetReason) return;

    this.decoderBudgetReason = nextReason;
    this.metrics.decoderBudgetReason = nextReason;
    this.decoderPool.setResourceBudget(DECODER_BUDGETS[nextReason]);
    systemPerformance.setDebugValue("editorDecoderBudget", {
      reason: nextReason,
      pressureRatio,
      ...DECODER_BUDGETS[nextReason],
    });
  }

  private buildTextObjects(timelineMs: number): SerializedTextObject[] {
    const textTrack = this.tracks.find((track) => track.type === "text");
    if (!textTrack) return [];

    return textTrack.clips
      .filter(isTextClip)
      .filter(
        (clip) =>
          timelineMs >= clip.startMs &&
          timelineMs < clip.startMs + clip.durationMs
      )
      .map((clip) => this.serializeTextClip(clip, timelineMs));
  }

  private serializeTextClip(
    clip: TextClip,
    timelineMs: number
  ): SerializedTextObject {
    const elapsedMs = timelineMs - clip.startMs;
    return {
      text: getTextClipPreviewDisplay(
        clip.textContent,
        clip.durationMs,
        elapsedMs,
        clip.textAutoChunk
      ),
      x: this.canvasWidth / 2 + (clip.positionX ?? 0),
      y: this.canvasHeight / 2 + (clip.positionY ?? 0),
      fontSize: clip.textStyle?.fontSize ?? 32,
      fontWeight: clip.textStyle?.fontWeight ?? "normal",
      color: clip.textStyle?.color ?? "#fff",
      align: clip.textStyle?.align ?? "center",
      opacity: clip.enabled === false ? 0 : (clip.opacity ?? 1),
      maxWidth: this.canvasWidth * 0.8,
      lineHeight: Math.max(1, (clip.textStyle?.fontSize ?? 32) * 1.2),
    };
  }

  private startRafLoop(): void {
    if (this.rafHandle != null) return;
    this.rafStartWallMs = performance.now();
    this.rafStartTimelineMs = this.currentTimeMs;
    this.lastAudibleTickMs = null;

    const tick = () => {
      const audibleMs = this.clampTime(this.audioMixer.getAudibleTimeMs());
      this.currentTimeMs = audibleMs;
      const wallElapsedMs = performance.now() - this.rafStartWallMs;
      const audioElapsedMs = audibleMs - this.rafStartTimelineMs;
      this.metrics.audioClockDriftMs = audioElapsedMs - wallElapsedMs;

      const frameBudgetMs = 1000 / Math.max(1, this.fps || 30);
      if (this.lastAudibleTickMs != null) {
        const audioDeltaMs = audibleMs - this.lastAudibleTickMs;
        if (audioDeltaMs > frameBudgetMs * 1.5) {
          const droppedFrames = Math.max(
            0,
            Math.round(audioDeltaMs / frameBudgetMs) - 1
          );
          this.metrics.droppedFrameCount += droppedFrames;
          this.observeFramePressure(droppedFrames);
        } else {
          this.observeFramePressure(0);
        }
      }
      this.lastAudibleTickMs = audibleMs;

      if (
        audibleMs - this.lastDecoderReconcileMs >=
        DECODER_RECONCILE_INTERVAL_MS
      ) {
        this.lastDecoderReconcileMs = audibleMs;
        this.observeMemoryPressure();
        this.decoderPool.update(this.tracks, this.assetUrlMap, audibleMs);
      }

      // Notify React-side subscribers (e.g. caption renderer) at the audio-clock
      // time. Called only from the RAF loop — NOT from renderCurrentFrame() —
      // to avoid re-entrant setState → renderCurrentFrame loops.
      this.callbacks.onRenderTick?.(audibleMs);
      this.tickCompositor(audibleMs);

      if (audibleMs - this.lastPublishMs >= REACT_PUBLISH_INTERVAL_MS) {
        this.lastPublishMs = audibleMs;
        this.publishTimeUpdate(audibleMs, "raf");
      }

      if (audibleMs >= this.durationMs) {
        this.stopRafLoop();
        this.decoderPool.pause();
        this.audioMixer.pause();
        this.isPlaying = false;
        this.currentTimeMs = this.durationMs;
        this.tickCompositor(this.durationMs);
        this.publishTimeUpdate(this.durationMs, "playback-end");
        this.logMetricsIfDevelopment();
        this.callbacks.onPlaybackEnd();
        return;
      }

      this.rafHandle = requestAnimationFrame(tick);
    };

    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopRafLoop(): void {
    if (this.rafHandle == null) return;
    cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  private clampTime(ms: number): number {
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.min(this.durationMs, ms));
  }

  private resetSessionMetrics(): void {
    this.droppedFramePressureCount = 0;
    this.stableFrameCount = 0;
    this.metrics = {
      seekCount: 0,
      decodedFrameCount: 0,
      droppedFrameCount: 0,
      compositorFrameMs: 0,
      reactPublishMs: 0,
      audioClockDriftMs: 0,
      decoderBudgetReason: this.decoderBudgetReason,
      previewQuality: this.previewQuality,
      lastSeekLatency: null,
    };
    this.activeSeekLatency = null;
    this.didLogMetricsForCurrentSession = false;
  }

  private logMetricsIfDevelopment(): void {
    if (this.didLogMetricsForCurrentSession) return;
    if (!IS_DEVELOPMENT) return;
    this.didLogMetricsForCurrentSession = true;
    console.table(this.getMetrics());
  }

  private publishTimeUpdate(
    playheadMs: number,
    reason: "raf" | "pause" | "playback-end"
  ): void {
    const timerId = systemPerformance.start("editor.reactPublish", {
      playheadMs,
      reason,
    });
    systemPerformance.mark("editor.reactPublish", { playheadMs, reason });
    this.markReactPublishAfterSeek(playheadMs, reason);
    this.callbacks.onTimeUpdate(playheadMs, reason);

    const measured = timerId
      ? systemPerformance.stop(timerId, { playheadMs, reason })
      : null;
    this.metrics.reactPublishMs = measured?.durationMs ?? 0;
  }

  private startSeekLatency(targetMs: number): void {
    this.seekSequence += 1;
    this.activeSeekLatency = {
      seekId: this.seekSequence,
      targetMs,
      requestedAtMs: performance.now(),
      firstDecodedFrameMs: null,
      firstCompositorTickMs: null,
      reactPublishMs: null,
    };
    this.metrics.lastSeekLatency = this.activeSeekLatency;
    systemPerformance.mark("editor.seek.request", {
      seekId: this.seekSequence,
      targetMs,
    });
  }

  private markFirstDecodedFrameAfterSeek(
    clipId: string,
    timestampUs: number
  ): void {
    const seek = this.activeSeekLatency;
    if (!seek || seek.firstDecodedFrameMs !== null) return;

    const detail = { seekId: seek.seekId, clipId, timestampUs };
    systemPerformance.mark("editor.seek.firstDecodedFrame", detail);
    const record = systemPerformance.measure(
      "editor.seek.latency.firstDecodedFrame",
      "editor.seek.request",
      "editor.seek.firstDecodedFrame",
      detail
    );
    seek.firstDecodedFrameMs = record?.durationMs ?? null;
  }

  private markFirstCompositorTickAfterSeek(playheadMs: number): void {
    const seek = this.activeSeekLatency;
    if (!seek || seek.firstCompositorTickMs !== null) return;

    const detail = { seekId: seek.seekId, playheadMs };
    systemPerformance.mark("editor.seek.firstCompositorTick", detail);
    const record = systemPerformance.measure(
      "editor.seek.latency.firstCompositorTick",
      "editor.seek.request",
      "editor.seek.firstCompositorTick",
      detail
    );
    seek.firstCompositorTickMs = record?.durationMs ?? null;
  }

  private markReactPublishAfterSeek(
    playheadMs: number,
    reason: "raf" | "pause" | "playback-end"
  ): void {
    const seek = this.activeSeekLatency;
    if (!seek || seek.reactPublishMs !== null) return;

    const detail = { seekId: seek.seekId, playheadMs, reason };
    const record = systemPerformance.measure(
      "editor.seek.latency.reactPublish",
      "editor.seek.request",
      "editor.reactPublish",
      detail
    );
    seek.reactPublishMs = record?.durationMs ?? null;
  }

  private getDebugSnapshot(): Record<string, unknown> {
    return {
      isPlaying: this.isPlaying,
      currentTimeMs: this.currentTimeMs,
      durationMs: this.durationMs,
      fps: this.fps,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      previewQuality: this.previewQuality,
      decoderBudgetReason: this.decoderBudgetReason,
      metrics: this.getMetrics(),
    };
  }
}
