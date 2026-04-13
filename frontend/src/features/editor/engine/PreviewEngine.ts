import {
  AudioMixer,
  buildAudioClipDescriptors,
  type AudioClipDescriptor,
} from "./AudioMixer";
import { DecoderPool } from "./DecoderPool";
import type { CompositorClipDescriptor } from "./CompositorWorker";
import type { Track, VideoClip } from "../types/editor";
import { isVideoClip } from "../utils/clip-types";
import {
  buildWarmthFilter,
  getIncomingTransitionStyle,
  getOutgoingTransitionStyle,
} from "../utils/editor-composition";

const REACT_PUBLISH_INTERVAL_MS = 250;
const DECODER_RECONCILE_INTERVAL_MS = 500;

export interface EffectPreviewPatch {
  clipId: string;
  patch: Partial<VideoClip>;
}

export interface PreviewEngineCallbacks {
  onTimeUpdate(ms: number): void;
  onPlaybackEnd(): void;
  onFrame(frame: VideoFrame, timestampUs: number, clipId: string): void;
  onTick(playheadMs: number, clips: CompositorClipDescriptor[]): void;
  onClearFrames(clipIds: string[]): void;
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
        zIndex: trackIndex,
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
  private tracks: Track[] = [];
  private assetUrlMap = new Map<string, string>();
  private effectPreview: EffectPreviewPatch | null = null;
  private metrics = {
    seekCount: 0,
    decodedFrameCount: 0,
    droppedFrameCount: 0,
    compositorFrameMs: 0,
    audioClockDriftMs: 0,
  };

  constructor(callbacks: PreviewEngineCallbacks) {
    this.callbacks = callbacks;
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
    effectPreview: EffectPreviewPatch | null
  ): void {
    this.tracks = tracks;
    this.assetUrlMap = assetUrlMap;
    this.durationMs = durationMs;
    this.effectPreview = effectPreview;

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
    this.isPlaying = true;
    await this.audioMixer.play(this.currentTimeMs, this.buildAudioClipDescriptors());
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
      if (
        !this.isPlaying ||
        requestToken !== this.playRequestToken
      ) {
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

  getMetrics() {
    return { ...this.metrics };
  }

  destroy(): void {
    this.stopRafLoop();
    this.decoderPool.destroy();
    this.audioMixer.destroy();
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
    this.callbacks.onTick(playheadMs, clips);
    this.metrics.compositorFrameMs = performance.now() - frameStart;
  }

  private startRafLoop(): void {
    if (this.rafHandle != null) return;

    const tick = () => {
      const audibleMs = this.clampTime(this.audioMixer.getAudibleTimeMs());
      this.currentTimeMs = audibleMs;

      if (
        audibleMs - this.lastDecoderReconcileMs >=
        DECODER_RECONCILE_INTERVAL_MS
      ) {
        this.lastDecoderReconcileMs = audibleMs;
        this.decoderPool.update(this.tracks, this.assetUrlMap, audibleMs);
      }

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
}
