import {
  AudioMixer,
  buildAudioClipDescriptors,
  type AudioClipDescriptor,
} from "./AudioMixer";
import { DecoderPool } from "./DecoderPool";
import type {
  CompositorClipDescriptor,
  SerializedCaptionFrame,
  SerializedTextObject,
} from "./CompositorWorker";
import type { TextClip, Track, VideoClip } from "../types/editor";
import { isTextClip, isVideoClip } from "../utils/clip-types";
import {
  buildWarmthFilter,
  getClipSourceTimeSecondsAtTimelineTime,
  getIncomingTransitionStyle,
  getOutgoingTransitionStyle,
} from "../utils/editor-composition";
import { getTextClipPreviewDisplay } from "../utils/text-segments";

const REACT_PUBLISH_INTERVAL_MS = 250;
const DECODER_RECONCILE_INTERVAL_MS = 500;

export interface PreviewEngineMetrics {
  seekCount: number;
  decodedFrameCount: number;
  droppedFrameCount: number;
  compositorFrameMs: number;
  audioClockDriftMs: number;
}

export interface EffectPreviewPatch {
  clipId: string;
  patch: Partial<VideoClip>;
}

export interface PreviewEngineCallbacks {
  onTimeUpdate(ms: number): void;
  onPlaybackEnd(): void;
  onFrame(frame: VideoFrame, timestampUs: number, clipId: string): void;
  onTick(
    playheadMs: number,
    clips: CompositorClipDescriptor[],
    textObjects: SerializedTextObject[],
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
      const effectiveScale = previewPatch?.scale ?? clip.scale ?? 1;
      const effectivePositionX = previewPatch?.positionX ?? clip.positionX ?? 0;
      const effectivePositionY = previewPatch?.positionY ?? clip.positionY ?? 0;
      const effectiveRotation = previewPatch?.rotation ?? clip.rotation ?? 0;

      const outgoing = getOutgoingTransitionStyle(
        clip,
        trackTransitions,
        timelineMs
      );
      const incoming = getIncomingTransitionStyle(
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

      const filterParts: string[] = [];
      if (contrast && contrast !== 0) {
        filterParts.push(`contrast(${1 + contrast / 100})`);
      }
      if (warmth && warmth !== 0) {
        filterParts.push(buildWarmthFilter(warmth));
      }

      const transitionTransform =
        typeof outgoing.transform === "string" ? outgoing.transform : null;
      const baseTransform = `scale(${effectiveScale}) translate(${effectivePositionX}px, ${effectivePositionY}px) rotate(${effectiveRotation}deg)`;

      clips.push({
        clipId: clip.id,
        zIndex: videoTracks.length - 1 - trackIndex,
        sourceTimeUs: Math.round(
          getClipSourceTimeSecondsAtTimelineTime(clip, timelineMs) * 1_000_000
        ),
        opacity,
        clipPath:
          typeof incoming?.clipPath === "string" ? incoming.clipPath : null,
        filter: filterParts.join(" ") || null,
        transform: transitionTransform ?? baseTransform,
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
  private canvasWidth: number;
  private canvasHeight: number;
  private fps: number;
  private tracks: Track[] = [];
  private assetUrlMap = new Map<string, string>();
  private effectPreview: EffectPreviewPatch | null = null;
  private pendingCaptionFrame: SerializedCaptionFrame | null | undefined =
    undefined;
  private metrics: PreviewEngineMetrics = {
    seekCount: 0,
    decodedFrameCount: 0,
    droppedFrameCount: 0,
    compositorFrameMs: 0,
    audioClockDriftMs: 0,
  };

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
      this.callbacks.onFrame(frame, timestampUs, clipId);
    });
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

    this.decoderPool.update(tracks, assetUrlMap, this.currentTimeMs);
    this.tickCompositor(this.currentTimeMs);
  }

  async play(): Promise<void> {
    if (this.isPlaying) return;
    const requestToken = this.playRequestToken + 1;
    this.playRequestToken = requestToken;
    this.resetSessionMetrics();
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
    this.callbacks.onTimeUpdate(this.currentTimeMs);
    this.logMetricsIfDevelopment();
  }

  async seek(ms: number): Promise<void> {
    const targetMs = this.clampTime(ms);
    const wasPlaying = this.isPlaying;
    const requestToken = this.playRequestToken + 1;
    this.playRequestToken = requestToken;

    this.stopRafLoop();
    this.decoderPool.pause();
    this.audioMixer.seek(targetMs);

    this.currentTimeMs = targetMs;
    this.metrics.seekCount += 1;

    const videoClipIds = collectVideoClipIds(this.tracks);
    if (videoClipIds.length > 0) {
      this.callbacks.onClearFrames(videoClipIds);
    }

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
    return { ...this.metrics };
  }

  destroy(): void {
    this.stopRafLoop();
    this.decoderPool.destroy();
    this.audioMixer.destroy();
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
    const clips = buildCompositorClips(
      this.tracks,
      playheadMs,
      this.effectPreview
    );
    const captionFrame = this.pendingCaptionFrame;
    this.pendingCaptionFrame = undefined;
    this.callbacks.onTick(
      playheadMs,
      clips,
      this.buildTextObjects(playheadMs),
      captionFrame
    );
    this.metrics.compositorFrameMs = performance.now() - frameStart;
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
          this.metrics.droppedFrameCount += Math.max(
            0,
            Math.round(audioDeltaMs / frameBudgetMs) - 1
          );
        }
      }
      this.lastAudibleTickMs = audibleMs;

      if (
        audibleMs - this.lastDecoderReconcileMs >=
        DECODER_RECONCILE_INTERVAL_MS
      ) {
        this.lastDecoderReconcileMs = audibleMs;
        this.decoderPool.update(this.tracks, this.assetUrlMap, audibleMs);
      }

      // Notify React-side subscribers (e.g. caption renderer) at the audio-clock
      // time. Called only from the RAF loop — NOT from renderCurrentFrame() —
      // to avoid re-entrant setState → renderCurrentFrame loops.
      this.callbacks.onRenderTick?.(audibleMs);
      this.tickCompositor(audibleMs);

      if (audibleMs - this.lastPublishMs >= REACT_PUBLISH_INTERVAL_MS) {
        this.lastPublishMs = audibleMs;
        this.callbacks.onTimeUpdate(audibleMs);
      }

      if (audibleMs >= this.durationMs) {
        this.stopRafLoop();
        this.decoderPool.pause();
        this.audioMixer.pause();
        this.isPlaying = false;
        this.currentTimeMs = this.durationMs;
        this.tickCompositor(this.durationMs);
        this.callbacks.onTimeUpdate(this.durationMs);
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
    this.metrics = {
      seekCount: 0,
      decodedFrameCount: 0,
      droppedFrameCount: 0,
      compositorFrameMs: 0,
      audioClockDriftMs: 0,
    };
    this.didLogMetricsForCurrentSession = false;
  }

  private logMetricsIfDevelopment(): void {
    if (this.didLogMetricsForCurrentSession) return;
    if (typeof process === "undefined") return;
    if (process.env.NODE_ENV !== "development") return;
    this.didLogMetricsForCurrentSession = true;
    console.table(this.getMetrics());
  }
}
