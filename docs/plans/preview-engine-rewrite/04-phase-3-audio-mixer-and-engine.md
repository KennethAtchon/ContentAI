# Phase 3: AudioContext Master Clock + PreviewEngine

**Goal:** `AudioContext.currentTime` drives the preview clock. Audio plays from `AudioBufferSourceNode` objects (Chrome/Firefox) or `HTMLAudioElement` (Safari). The rAF loop reads the audio clock and ticks the compositor — not React state. React sees a time update at ~4 Hz, not 60 Hz. Full play, pause, and seek work.

**Done criteria:**
- `AudioMixer.ts` exists with working play/pause/seek/mute
- `PreviewEngine.ts` wires `AudioMixer`, `DecoderPool`, and compositor together
- `usePreviewEngine.ts` is the React bridge; `PreviewCanvas` receives ticks from it
- `EditorWorkspace.tsx` uses `usePreviewEngine` — the test harness from Phase 2 is deleted
- Pressing play in the editor plays audio and video in sync
- `seekCount` during steady 1x playback is 0 (no seeks happen while playing forward)
- React Profiler shows ~4 commits/second during playback, not 60

---

## Step 1 — Create `AudioMixer.ts`

Create `frontend/src/features/editor/engine/AudioMixer.ts`:

```ts
/**
 * AudioMixer — owns the AudioContext and all audio scheduling.
 *
 * Architecture:
 *   AudioContext (single, created once per engine lifetime)
 *     └─ masterGainNode → destination
 *         └─ trackGainNode (per track: audio, music, video-with-audio)
 *             └─ AudioBufferSourceNode (per clip, Chrome/Firefox)
 *                 OR HTMLAudioElement via createMediaElementSource (Safari)
 *
 * The AudioContext clock is the master timeline. getAudibleTimeMs() returns
 * the media time currently audible at the speaker, compensated for hardware
 * output latency.
 */

import type { Track } from "../types/editor";
import { isMediaClip } from "../utils/clip-types";
import { getClipSourceTimeSecondsAtTimelineTime } from "../utils/editor-composition";

const isSafari =
  typeof navigator !== "undefined" &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export interface AudioClipDescriptor {
  clipId: string;
  assetUrl: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  speed: number;
  volume: number;
  muted: boolean;
  trackId: string;
  trackMuted: boolean;
}

interface ScheduledSource {
  clipId: string;
  /** Chrome/Firefox path */
  bufferSource?: AudioBufferSourceNode;
  /** Safari path */
  mediaElement?: HTMLAudioElement;
  mediaElementSource?: MediaElementAudioSourceNode;
  gainNode: GainNode;
}

export class AudioMixer {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private trackGains = new Map<string, GainNode>();
  private scheduledSources = new Map<string, ScheduledSource>();
  /** Context time when play() was last called. */
  private playStartContextTime = 0;
  /** Timeline position (ms) when play() was last called. */
  private playStartTimelineMs = 0;
  private isPlaying = false;

  constructor() {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  /**
   * Returns the current audible timeline position in milliseconds.
   * Use this as the master clock for compositor ticks.
   *
   * Formula:
   *   audibleContextTime = audioContext.currentTime - audioContext.baseLatency
   *   elapsedMs = (audibleContextTime - playStartContextTime) * 1000
   *   timelineMs = playStartTimelineMs + elapsedMs
   */
  getAudibleTimeMs(): number {
    if (!this.isPlaying) return this.playStartTimelineMs;
    const audibleContextTime =
      this.audioContext.currentTime - (this.audioContext.baseLatency ?? 0);
    const elapsedMs = (audibleContextTime - this.playStartContextTime) * 1000;
    return this.playStartTimelineMs + elapsedMs;
  }

  /**
   * Resume the AudioContext (must be called from a user gesture) and start
   * scheduling sources for all clips in the descriptor list.
   */
  async play(
    timelineMs: number,
    clips: AudioClipDescriptor[]
  ): Promise<void> {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.stopAllSources();
    this.playStartTimelineMs = timelineMs;
    this.playStartContextTime =
      this.audioContext.currentTime - (this.audioContext.baseLatency ?? 0);
    this.isPlaying = true;

    for (const clip of clips) {
      if (clip.muted || clip.trackMuted) continue;
      // Only schedule clips that overlap the playhead position.
      const clipEndMs = clip.startMs + clip.durationMs;
      if (timelineMs >= clipEndMs) continue; // already past this clip

      const trackGain = this.getOrCreateTrackGain(clip.trackId);

      if (isSafari) {
        await this.scheduleSafariAudio(clip, timelineMs, trackGain);
      } else {
        await this.scheduleBufferSourceAudio(clip, timelineMs, trackGain);
      }
    }
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.playStartTimelineMs = this.getAudibleTimeMs();
    this.isPlaying = false;
    this.stopAllSources();
    // Suspend rather than close so resume() is fast.
    void this.audioContext.suspend();
  }

  async seek(timelineMs: number, clips: AudioClipDescriptor[]): Promise<void> {
    this.pause();
    this.playStartTimelineMs = timelineMs;
    // Re-play from the new position immediately if we were playing.
    // Caller (PreviewEngine) decides whether to re-call play().
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const gain = this.trackGains.get(trackId);
    if (gain) gain.gain.setValueAtTime(muted ? 0 : 1, this.audioContext.currentTime);
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  destroy(): void {
    this.stopAllSources();
    void this.audioContext.close();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private getOrCreateTrackGain(trackId: string): GainNode {
    if (!this.trackGains.has(trackId)) {
      const gain = this.audioContext.createGain();
      gain.connect(this.masterGain);
      this.trackGains.set(trackId, gain);
    }
    return this.trackGains.get(trackId)!;
  }

  private async scheduleBufferSourceAudio(
    clip: AudioClipDescriptor,
    timelineMs: number,
    trackGain: GainNode
  ): Promise<void> {
    let buffer: AudioBuffer;
    try {
      const response = await fetch(clip.assetUrl);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn(`[AudioMixer] Failed to decode audio for clip ${clip.clipId}:`, e);
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clip.speed;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = clip.volume ?? 1;
    source.connect(gainNode);
    gainNode.connect(trackGain);

    // If the playhead is already inside this clip, we need an offset into the buffer.
    const playheadInsideClipMs = Math.max(0, timelineMs - clip.startMs);
    const bufferOffsetSec =
      (clip.trimStartMs + playheadInsideClipMs * (clip.speed ?? 1)) / 1000;

    // When in context time should this source start?
    // It started (clip.startMs - timelineMs) ms ago in wall time.
    // If startMs > timelineMs it starts in the future; if startMs < timelineMs it started in the past (offset handles it).
    const contextStartTime =
      this.playStartContextTime +
      Math.max(0, (clip.startMs - timelineMs) / 1000);

    source.start(contextStartTime, bufferOffsetSec);

    this.scheduledSources.set(clip.clipId, {
      clipId: clip.clipId,
      bufferSource: source,
      gainNode,
    });
  }

  private async scheduleSafariAudio(
    clip: AudioClipDescriptor,
    timelineMs: number,
    trackGain: GainNode
  ): Promise<void> {
    const audio = new Audio(clip.assetUrl);
    audio.preload = "auto";

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = clip.volume ?? 1;

    // createMediaElementSource requires the element to be connected before play().
    const source = this.audioContext.createMediaElementSource(audio);
    source.connect(gainNode);
    gainNode.connect(trackGain);

    // Seek the element to the correct position.
    const playheadInsideClipSec = Math.max(0, (timelineMs - clip.startMs) / 1000);
    const sourcePositionSec = clip.trimStartMs / 1000 + playheadInsideClipSec;
    audio.currentTime = sourcePositionSec;
    audio.playbackRate = clip.speed ?? 1;

    if (clip.startMs <= timelineMs) {
      await audio.play().catch(() => {});
    } else {
      // Schedule future start.
      const delayMs = clip.startMs - timelineMs;
      setTimeout(() => audio.play().catch(() => {}), delayMs);
    }

    this.scheduledSources.set(clip.clipId, {
      clipId: clip.clipId,
      mediaElement: audio,
      mediaElementSource: source,
      gainNode,
    });
  }

  private stopAllSources(): void {
    for (const [, src] of this.scheduledSources) {
      try {
        src.bufferSource?.stop();
        src.mediaElement?.pause();
        src.mediaElementSource?.disconnect();
        src.gainNode.disconnect();
      } catch {
        // Ignore errors from already-stopped sources.
      }
    }
    this.scheduledSources.clear();
  }
}
```

---

## Step 2 — Create `PreviewEngine.ts`

Create `frontend/src/features/editor/engine/PreviewEngine.ts`:

```ts
/**
 * PreviewEngine — top-level class wiring AudioMixer, DecoderPool, and CompositorWorker.
 *
 * The engine is created once per editor mount and destroyed on unmount.
 * React interacts with it only through usePreviewEngine.
 *
 * Clock model:
 *   AudioContext.currentTime → AudioMixer.getAudibleTimeMs() → rAF loop → compositor TICK
 *   React state updated at ~4 Hz (every 250ms) for playhead and timecode display.
 */

import { AudioMixer, type AudioClipDescriptor } from "./AudioMixer";
import { DecoderPool } from "./DecoderPool";
import type { Track, VideoClip, AudioClip, MusicClip } from "../types/editor";
import { isVideoClip, isMediaClip } from "../utils/clip-types";
import { getClipSourceTimeSecondsAtTimelineTime } from "../utils/editor-composition";
import type { CompositorClipDescriptor } from "./CompositorWorker";
import {
  getOutgoingTransitionStyle,
  getIncomingTransitionStyle,
  buildWarmthFilter,
} from "../utils/editor-composition";

const REACT_PUBLISH_INTERVAL_MS = 250; // ~4 Hz

export interface PreviewEngineCallbacks {
  /** Called ~4 Hz during playback with the current audible time. */
  onTimeUpdate(ms: number): void;
  /** Called when playback reaches the end of the composition. */
  onPlaybackEnd(): void;
  /** Called when a decoded frame arrives (relay to compositor). */
  onFrame(frame: VideoFrame, timestampUs: number, clipId: string): void;
}

export interface EffectPreviewPatch {
  clipId: string;
  patch: Partial<VideoClip>;
}

export class PreviewEngine {
  private audioMixer: AudioMixer;
  private decoderPool: DecoderPool;
  private callbacks: PreviewEngineCallbacks;

  private rafHandle: number | null = null;
  private lastPublishMs = 0;
  private currentTimeMs = 0;
  private durationMs = 0;
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
    this.audioMixer = new AudioMixer();
    this.decoderPool = new DecoderPool(
      ({ frame, timestampUs, clipId }) => {
        this.metrics.decodedFrameCount++;
        callbacks.onFrame(frame, timestampUs, clipId);
      },
      () => {} // audio chunks handled by AudioMixer, not DecoderPool
    );
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async play(): Promise<void> {
    const audioClips = this.buildAudioClipDescriptors();
    await this.audioMixer.play(this.currentTimeMs, audioClips);
    this.startRafLoop();
  }

  pause(): void {
    this.stopRafLoop();
    this.audioMixer.pause();
    this.callbacks.onTimeUpdate(this.currentTimeMs);
  }

  async seek(ms: number): Promise<void> {
    this.currentTimeMs = ms;
    await this.audioMixer.seek(ms, this.buildAudioClipDescriptors());
    this.decoderPool.seekAll(this.tracks, ms);
    this.metrics.seekCount++;
    // Trigger a single compositor tick to show the correct frame at the new position.
    this.callbacks.onTimeUpdate(ms);
  }

  /**
   * Called whenever the timeline or assetUrlMap changes (editor edits).
   * Updates decoder pool and audio scheduling without destroying the engine.
   */
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
    this.decoderPool.update(tracks, assetUrlMap, this.currentTimeMs);
  }

  setCurrentTime(ms: number): void {
    this.currentTimeMs = ms;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  destroy(): void {
    this.stopRafLoop();
    this.audioMixer.destroy();
    this.decoderPool.destroy();
  }

  // ─── rAF loop ────────────────────────────────────────────────────────────────

  private startRafLoop(): void {
    if (this.rafHandle !== null) return;
    const tick = () => {
      const audibleMs = this.audioMixer.getAudibleTimeMs();
      this.currentTimeMs = audibleMs;

      // Drift diagnostic (dev only).
      if (process.env.NODE_ENV === "development") {
        const wallMs = performance.now();
        // We can't easily measure drift without a wall-clock reference start point.
        // Skip this for now — add a wall clock baseline in Phase 5.
      }

      // Publish to React at ~4 Hz.
      if (audibleMs - this.lastPublishMs >= REACT_PUBLISH_INTERVAL_MS) {
        this.lastPublishMs = audibleMs;
        this.callbacks.onTimeUpdate(audibleMs);
      }

      // Check if we've reached the end.
      if (audibleMs >= this.durationMs) {
        this.stopRafLoop();
        this.audioMixer.pause();
        this.callbacks.onPlaybackEnd();
        return;
      }

      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopRafLoop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  // ─── Descriptor builders ─────────────────────────────────────────────────────

  private buildAudioClipDescriptors(): AudioClipDescriptor[] {
    const descriptors: AudioClipDescriptor[] = [];
    for (const track of this.tracks) {
      if (track.type !== "audio" && track.type !== "music") continue;
      for (const clip of track.clips.filter(isMediaClip)) {
        const assetUrl = clip.assetId ? this.assetUrlMap.get(clip.assetId) : undefined;
        if (!assetUrl) continue;
        descriptors.push({
          clipId: clip.id,
          assetUrl,
          startMs: clip.startMs,
          durationMs: clip.durationMs,
          trimStartMs: clip.trimStartMs,
          speed: clip.speed ?? 1,
          volume: clip.volume ?? 1,
          muted: clip.muted ?? false,
          trackId: track.id,
          trackMuted: track.muted,
        });
      }
    }
    return descriptors;
  }

  /**
   * Build CompositorClipDescriptor array for the given timeline time.
   * This is the same logic that was in preview-scene.ts / PreviewArea.tsx,
   * now moved here and producing a serializable format for the worker.
   */
  buildCompositorClips(timelineMs: number): CompositorClipDescriptor[] {
    const clips: CompositorClipDescriptor[] = [];
    const videoTracks = this.tracks.filter((t) => t.type === "video");

    for (let trackIdx = 0; trackIdx < videoTracks.length; trackIdx++) {
      const track = videoTracks[trackIdx];
      const trackClips = track.clips.filter(isVideoClip);
      const trackTransitions = track.transitions ?? [];

      for (const clip of trackClips) {
        const effectPatch =
          this.effectPreview?.clipId === clip.id ? this.effectPreview.patch : null;

        const contrast = effectPatch?.contrast ?? clip.contrast;
        const warmth = effectPatch?.warmth ?? clip.warmth;
        const baseOpacity = effectPatch?.opacity ?? clip.opacity ?? 1;

        const outgoing = getOutgoingTransitionStyle(clip, trackTransitions, timelineMs);
        const incoming = getIncomingTransitionStyle(clip, trackTransitions, trackClips, timelineMs);

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
        if (contrast && contrast !== 0) filterParts.push(`contrast(${1 + contrast / 100})`);
        if (warmth && warmth !== 0) filterParts.push(buildWarmthFilter(warmth));

        const transform =
          (outgoing.transform as string | undefined) ??
          `scale(${clip.scale ?? 1}) translate(${clip.positionX ?? 0}px, ${clip.positionY ?? 0}px) rotate(${clip.rotation ?? 0}deg)`;

        clips.push({
          clipId: clip.id,
          zIndex: trackIdx,
          opacity,
          clipPath: (incoming?.clipPath as string | undefined) ?? null,
          filter: filterParts.length > 0 ? filterParts.join(" ") : null,
          transform,
          enabled: clip.enabled !== false,
        });
      }
    }

    return clips;
  }
}
```

---

## Step 3 — Create `usePreviewEngine.ts`

Create `frontend/src/features/editor/hooks/usePreviewEngine.ts`:

```ts
import { useRef, useEffect, useCallback, useState } from "react";
import { PreviewEngine } from "../engine/PreviewEngine";
import type { Track } from "../types/editor";
import type { PreviewCanvasHandle } from "../components/PreviewCanvas";
import type { EffectPreviewPatch } from "../engine/PreviewEngine";

interface UsePreviewEngineParams {
  tracks: Track[];
  assetUrlMap: Map<string, string>;
  durationMs: number;
  isPlaying: boolean;
  currentTimeMs: number;      // from reducer — source of truth for seeks and scrubs
  effectPreview: EffectPreviewPatch | null;
  canvasRef: React.RefObject<PreviewCanvasHandle | null>;
  onPlaybackEnd: () => void;
}

interface UsePreviewEngineResult {
  /** Current playback position at ~4 Hz. Use for playhead display and timecode. */
  playheadMs: number;
}

export function usePreviewEngine({
  tracks,
  assetUrlMap,
  durationMs,
  isPlaying,
  currentTimeMs,
  effectPreview,
  canvasRef,
  onPlaybackEnd,
}: UsePreviewEngineParams): UsePreviewEngineResult {
  const engineRef = useRef<PreviewEngine | null>(null);
  const [playheadMs, setPlayheadMs] = useState(currentTimeMs);
  const isPlayingRef = useRef(isPlaying);
  const prevCurrentTimeMsRef = useRef(currentTimeMs);

  // Create engine once on mount.
  useEffect(() => {
    const engine = new PreviewEngine({
      onTimeUpdate(ms) {
        setPlayheadMs(ms);
        // Also tick the compositor on every audio-clock update.
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const clips = engine.buildCompositorClips(ms);
        // Text overlays and captions are sent via a separate OVERLAY message
        // in the caption integration (Phase 4). For now send empty.
        canvas.tick(ms, clips, [], null);
      },
      onPlaybackEnd() {
        onPlaybackEnd();
      },
      onFrame(frame, timestampUs, clipId) {
        canvasRef.current?.receiveFrame(frame, timestampUs, clipId);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — engine is created once, updated via engine.update()

  // Sync timeline changes into the engine.
  useEffect(() => {
    engineRef.current?.update(tracks, assetUrlMap, durationMs, effectPreview);
  }, [tracks, assetUrlMap, durationMs, effectPreview]);

  // Handle play/pause transitions.
  useEffect(() => {
    const wasPlaying = isPlayingRef.current;
    isPlayingRef.current = isPlaying;

    if (isPlaying && !wasPlaying) {
      void engineRef.current?.play();
    } else if (!isPlaying && wasPlaying) {
      engineRef.current?.pause();
    }
  }, [isPlaying]);

  // Handle explicit seeks (when not playing, or when currentTimeMs jumps discontinuously).
  useEffect(() => {
    const delta = Math.abs(currentTimeMs - prevCurrentTimeMsRef.current);
    prevCurrentTimeMsRef.current = currentTimeMs;

    if (!isPlaying && delta > 0) {
      // User scrubbed while paused.
      void engineRef.current?.seek(currentTimeMs);
      setPlayheadMs(currentTimeMs);
    }
  }, [currentTimeMs, isPlaying]);

  return { playheadMs };
}
```

---

## Step 4 — Update `EditorWorkspace.tsx`

Delete the Phase 2 test harness. Wire `usePreviewEngine`.

**File:** `frontend/src/features/editor/components/EditorWorkspace.tsx`

```tsx
import { useRef, useCallback } from "react";
import type { Clip, EditProject, Track, Transition } from "../types/editor";
import type { TabKey } from "./MediaPanel";
import { MediaPanel } from "./MediaPanel";
import { PreviewCanvas, type PreviewCanvasHandle } from "./PreviewCanvas";
import { Inspector } from "./Inspector";
import { useEditorContext } from "../context/EditorContext";
import { usePreviewEngine } from "../hooks/usePreviewEngine";
import { useAssetUrlMap } from "../contexts/asset-url-map-context";

interface EditorWorkspaceProps {
  project: EditProject;
  tracks: Track[];
  currentTimeMs: number;
  previewCurrentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  durationMs: number;
  resolution: string;
  selectedTransition: Transition | null;
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  mediaActiveTab: TabKey;
  pendingAdd: { trackId: string; startMs: number } | null;
  isReadOnly: boolean;
  onPlaybackEnd: () => void;
  onSetEffectPreview: (value: { clipId: string; patch: Partial<Clip> } | null) => void;
  onSetMediaActiveTab: (tab: TabKey) => void;
  onClearPendingAdd: () => void;
  onAddClip: (trackId: string, clip: Clip) => void;
}

export function EditorWorkspace({
  project,
  tracks,
  currentTimeMs,
  isPlaying,
  durationMs,
  resolution,
  selectedTransition,
  effectPreview,
  mediaActiveTab,
  pendingAdd,
  isReadOnly,
  onPlaybackEnd,
  onSetEffectPreview,
  onSetMediaActiveTab,
  onClearPendingAdd,
  onAddClip,
}: EditorWorkspaceProps) {
  const { state } = useEditorContext();
  const assetUrlMap = useAssetUrlMap();
  const canvasRef = useRef<PreviewCanvasHandle>(null);

  const { playheadMs } = usePreviewEngine({
    tracks,
    assetUrlMap,
    durationMs,
    isPlaying,
    currentTimeMs,
    effectPreview: effectPreview
      ? { clipId: effectPreview.clipId, patch: effectPreview.patch }
      : null,
    canvasRef,
    onPlaybackEnd,
  });

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <MediaPanel
        generatedContentId={project.generatedContentId}
        currentTimeMs={currentTimeMs}
        onAddClip={onAddClip}
        readOnly={isReadOnly}
        activeTab={mediaActiveTab}
        onTabChange={onSetMediaActiveTab}
        pendingAdd={pendingAdd}
        onClearPendingAdd={onClearPendingAdd}
      />

      <PreviewCanvas ref={canvasRef} resolution={resolution} />

      <Inspector
        onEffectPreview={(patch) =>
          onSetEffectPreview(
            patch && state.selectedClipId
              ? { clipId: state.selectedClipId, patch }
              : null
          )
        }
        selectedTransition={selectedTransition}
      />
    </div>
  );
}
```

---

## Step 5 — Update `EditorLayout.tsx`

Add `onPlaybackEnd` prop to `EditorWorkspace`. The callback calls `store.setPlaying(false)`.

**File:** `frontend/src/features/editor/components/EditorLayout.tsx`

In the `<EditorWorkspace>` block, add:
```tsx
onPlaybackEnd={() => store.setPlaying(false)}
```

---

## Step 6 — Update `useEditorLayoutRuntime.ts`

The `previewCurrentTimeMs` passthrough from Phase 0 can now be removed from the return value entirely — `usePreviewEngine` owns that state and returns it directly in `EditorWorkspace`. But `EditorLayout` still passes `previewCurrentTimeMs` down. You can either:

**Option A (simplest):** Keep `previewCurrentTimeMs: store.state.currentTimeMs` in the return value — it is now only used by `WaveformBars` and the playhead scroll hook (Phase 5 cleanup). This is fine for now.

**Option B:** Remove it entirely and thread `playheadMs` from `usePreviewEngine` up through `EditorWorkspace` to whichever consumers need it. Do this in Phase 5.

**Recommendation:** Option A for now.

---

## Step 7 — Verify

1. Open a project with a video clip and an audio/music clip.
2. Press Play. Audio should play continuously without glitches.
3. Open DevTools → Performance → Record 5 seconds of playback.
   - Look for React "commit" markers. You should see ~4 per second, not 60.
4. Open DevTools → Console. Add this to `PreviewEngine.ts` (temporarily):
   ```ts
   // In the rAF loop, after computing audibleMs:
   console.log("[seekCount]", this.metrics.seekCount);
   ```
   During 10 seconds of steady playback, `seekCount` should remain 0.
5. Pause. Video and audio should stop together.
6. Scrub the timeline. The canvas should update to the correct frame position.
7. Run `bun run type-check` — zero errors.

---

## Rollback

If Phase 3 needs to be reverted before shipping: replace `usePreviewEngine` in `EditorWorkspace` with the Phase 0 static canvas and show the placeholder. The engine is fully self-contained — removing `usePreviewEngine` and the engine files leaves the editor functional with the static canvas.
