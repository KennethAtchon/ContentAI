/* global Audio, AudioBuffer, AudioBufferSourceNode, GainNode, MediaElementAudioSourceNode */

/**
 * AudioMixer - preview audio scheduler.
 *
 * PreviewEngine calls this alongside the video decode/compositor pipeline. The
 * mixer does not render pixels; it keeps Web Audio playback aligned to the
 * timeline playhead and reports the audio clock back through getAudibleTimeMs().
 *
 * High-level flow:
 *   1. buildAudioClipDescriptors() flattens timeline tracks into schedulable clips.
 *   2. play(timelineMs, clips) stops old sources, records an audio-clock anchor,
 *      and schedules every audible clip from the requested timeline position.
 *   3. getAudibleTimeMs() maps AudioContext.currentTime back to timeline ms so
 *      video/compositor ticks can follow the sound instead of requestAnimationFrame.
 *   4. pause()/seek()/destroy() tear down browser audio nodes and timers.
 *
 * Browser note: most browsers use decoded AudioBufferSourceNode playback. Safari
 * gets a media-element path because it has historically been more fragile around
 * Web Audio decoding/playback for some media assets.
 */

import type { Track } from "../types/editor";
import { isMediaClip } from "../utils/clip-types";

const AUDIO_CLOCK_PUBLISH_FLOOR_MS = 0;

export interface AudioClipDescriptor {
  clipId: string;
  assetUrl: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  sourceMaxDurationMs?: number;
  speed: number;
  volume: number;
  muted: boolean;
  trackId: string;
  trackMuted: boolean;
}

interface ScheduledSource {
  clipId: string;
  gainNode: GainNode;
  bufferSource?: AudioBufferSourceNode;
  mediaElement?: HTMLAudioElement;
  mediaElementSource?: MediaElementAudioSourceNode;
  startTimerId?: number;
  endTimerId?: number;
}

interface TimelinePlaybackWindow {
  startDelayMs: number;
  remainingTimelineMs: number;
}

export function buildAudioClipDescriptors(
  tracks: Track[],
  assetUrlMap: Map<string, string>
): AudioClipDescriptor[] {
  const descriptors: AudioClipDescriptor[] = [];

  for (const track of tracks) {
    if (!isAudioBearingTrack(track.type)) continue;

    for (const clip of track.clips.filter(isMediaClip)) {
      const assetUrl = clip.assetId ? assetUrlMap.get(clip.assetId) : undefined;
      if (!assetUrl) continue;

      descriptors.push({
        clipId: clip.id,
        assetUrl,
        startMs: clip.startMs,
        durationMs: clip.durationMs,
        trimStartMs: clip.trimStartMs,
        sourceMaxDurationMs: clip.sourceMaxDurationMs,
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

export class AudioMixer {
  /**
   * AudioContext is nullable because tests/server-like environments may not have
   * browser audio APIs. The mixer still tracks playhead state in that case.
   */
  private readonly audioContext: AudioContext | null;
  private readonly masterGain: GainNode | null;
  private readonly isSafari = detectSafari();
  /** One gain node per timeline track, all connected into masterGain. */
  private readonly trackGains = new Map<string, GainNode>();
  /** Active browser audio nodes/timers keyed by clip id; every entry must be stopped. */
  private readonly scheduledSources = new Map<string, ScheduledSource>();
  /** Promise cache prevents repeated fetch/decode for the same asset URL. */
  private readonly decodedBufferCache = new Map<string, Promise<AudioBuffer>>();

  /** AudioContext time at which playback started/resumed. */
  private playStartContextTime = 0;
  /** Timeline position that corresponds to playStartContextTime. */
  private playStartTimelineMs = 0;
  private isPlaying = false;
  /**
   * Incremented whenever a schedule is invalidated. Async decode/timer callbacks
   * compare their captured generation to avoid starting stale audio after seek.
   */
  private scheduleGeneration = 0;

  constructor() {
    const AudioContextCtor = getAudioContextCtor();
    this.audioContext = AudioContextCtor ? new AudioContextCtor() : null;
    this.masterGain = this.audioContext?.createGain() ?? null;
    if (this.audioContext && this.masterGain) {
      this.masterGain.connect(this.audioContext.destination);
    }
  }

  // ---------------------------------------------------------------------------
  // Public playback lifecycle
  // ---------------------------------------------------------------------------

  async prime(): Promise<void> {
    await this.resumeAudioContext();
  }

  getAudibleTimeMs(): number {
    if (!this.audioContext || !this.isPlaying) {
      return Math.max(AUDIO_CLOCK_PUBLISH_FLOOR_MS, this.playStartTimelineMs);
    }

    const elapsedMs =
      (this.getAudibleContextTime() - this.playStartContextTime) * 1000;
    return Math.max(
      AUDIO_CLOCK_PUBLISH_FLOOR_MS,
      this.playStartTimelineMs + elapsedMs
    );
  }

  async play(timelineMs: number, clips: AudioClipDescriptor[]): Promise<void> {
    this.preparePlaybackStart(timelineMs);

    if (!this.audioContext) {
      this.isPlaying = true;
      return;
    }

    await this.resumeAudioContext();
    this.playStartContextTime = this.getAudibleContextTime();
    this.isPlaying = true;

    const generation = this.scheduleGeneration;
    await Promise.all(
      clips.map((clip) => this.scheduleClip(clip, timelineMs, generation))
    );
  }

  pause(): void {
    if (!this.isPlaying) return;

    this.playStartTimelineMs = this.getAudibleTimeMs();
    this.isPlaying = false;
    this.stopAllSources();

    if (this.audioContext?.state === "running") {
      void this.audioContext.suspend().catch(() => {});
    }
  }

  seek(timelineMs: number): void {
    this.pause();
    this.playStartTimelineMs = timelineMs;
  }

  setTrackMute(trackId: string, muted: boolean): void {
    if (!this.audioContext) return;
    const gain = this.trackGains.get(trackId);
    gain?.gain.setValueAtTime(muted ? 0 : 1, this.audioContext.currentTime);
  }

  setMasterVolume(volume: number): void {
    if (!this.audioContext || !this.masterGain) return;
    this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  destroy(): void {
    this.stopAllSources();
    this.trackGains.clear();
    this.decodedBufferCache.clear();

    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close().catch(() => {});
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  private preparePlaybackStart(timelineMs: number): void {
    // Invalidate old async work first; play() creates one fresh generation.
    this.stopAllSources();
    this.scheduleGeneration += 1;
    this.playStartTimelineMs = timelineMs;
  }

  private async scheduleClip(
    clip: AudioClipDescriptor,
    timelineMs: number,
    generation: number
  ): Promise<void> {
    if (!this.audioContext || !this.shouldScheduleClip(clip, timelineMs)) {
      return;
    }

    const trackGain = this.getOrCreateTrackGain(clip.trackId);
    trackGain.gain.setValueAtTime(
      clip.trackMuted ? 0 : 1,
      this.audioContext.currentTime
    );

    if (this.isSafari) {
      await this.scheduleSafariAudio(clip, timelineMs, trackGain, generation);
      return;
    }

    await this.scheduleBufferSourceAudio(
      clip,
      timelineMs,
      trackGain,
      generation
    );
  }

  private shouldScheduleClip(
    clip: AudioClipDescriptor,
    timelineMs: number
  ): boolean {
    if (clip.muted || clip.trackMuted) return false;
    return timelineMs < clip.startMs + clip.durationMs;
  }

  private async scheduleBufferSourceAudio(
    clip: AudioClipDescriptor,
    timelineMs: number,
    trackGain: GainNode,
    generation: number
  ): Promise<void> {
    if (!this.audioContext) return;

    const buffer = await this.loadDecodedBufferForClip(clip);
    if (!buffer || !this.isCurrentSchedule(generation)) return;

    const offsetSec = this.getSourceOffsetSeconds(clip, timelineMs);
    const durationSec = this.getRemainingSourceDurationSeconds(
      clip,
      timelineMs,
      buffer.duration
    );

    if (durationSec <= 0 || offsetSec >= buffer.duration) return;

    // AudioBufferSourceNode is one-shot: create a fresh node for every play().
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clip.speed;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = clip.volume;
    source.connect(gainNode);
    gainNode.connect(trackGain);

    source.start(
      this.getContextStartTimeForClip(clip, timelineMs),
      offsetSec,
      durationSec
    );

    this.scheduledSources.set(clip.clipId, {
      clipId: clip.clipId,
      bufferSource: source,
      gainNode,
    });
  }

  private async scheduleSafariAudio(
    clip: AudioClipDescriptor,
    timelineMs: number,
    trackGain: GainNode,
    generation: number
  ): Promise<void> {
    if (!this.audioContext) return;

    const audio = new Audio(clip.assetUrl);
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.playbackRate = clip.speed;
    audio.currentTime = this.getSourceOffsetSeconds(clip, timelineMs);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = clip.volume;

    const source = this.audioContext.createMediaElementSource(audio);
    source.connect(gainNode);
    gainNode.connect(trackGain);

    if (!this.isCurrentSchedule(generation)) {
      source.disconnect();
      gainNode.disconnect();
      return;
    }

    const timers = this.scheduleSafariElementTimers(
      audio,
      clip,
      timelineMs,
      generation
    );

    this.scheduledSources.set(clip.clipId, {
      clipId: clip.clipId,
      mediaElement: audio,
      mediaElementSource: source,
      gainNode,
      ...timers,
    });
  }

  private scheduleSafariElementTimers(
    audio: HTMLAudioElement,
    clip: AudioClipDescriptor,
    timelineMs: number,
    generation: number
  ): Pick<ScheduledSource, "startTimerId" | "endTimerId"> {
    let startTimerId: number | undefined;
    let endTimerId: number | undefined;

    const startPlayback = () => {
      if (!this.isCurrentSchedule(generation)) return;
      void audio.play().catch(() => {});
    };

    const stopPlayback = () => {
      if (generation !== this.scheduleGeneration) return;
      audio.pause();
    };

    const playbackWindow = this.getTimelinePlaybackWindow(clip, timelineMs);
    if (playbackWindow.startDelayMs === 0) {
      startPlayback();
    } else {
      startTimerId = window.setTimeout(
        startPlayback,
        playbackWindow.startDelayMs
      );
    }

    if (playbackWindow.remainingTimelineMs > 0) {
      endTimerId = window.setTimeout(
        stopPlayback,
        playbackWindow.remainingTimelineMs
      );
    }

    return { startTimerId, endTimerId };
  }

  // ---------------------------------------------------------------------------
  // Audio data and timing helpers
  // ---------------------------------------------------------------------------

  private async loadDecodedBufferForClip(
    clip: AudioClipDescriptor
  ): Promise<AudioBuffer | null> {
    try {
      return await this.getDecodedBuffer(clip.assetUrl);
    } catch (error) {
      console.warn(
        `[AudioMixer] Failed to decode audio for clip ${clip.clipId}:`,
        error
      );
      return null;
    }
  }

  private async getDecodedBuffer(assetUrl: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error("Cannot decode audio without AudioContext");
    }

    const existing = this.decodedBufferCache.get(assetUrl);
    if (existing) return existing;

    const pending = fetch(assetUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${assetUrl}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => this.audioContext!.decodeAudioData(arrayBuffer));

    const recoverablePending = pending.catch((error) => {
      // Failed decodes are not cached forever; a later play can retry the asset.
      if (this.decodedBufferCache.get(assetUrl) === recoverablePending) {
        this.decodedBufferCache.delete(assetUrl);
      }
      throw error;
    });

    this.decodedBufferCache.set(assetUrl, recoverablePending);
    return recoverablePending;
  }

  private getOrCreateTrackGain(trackId: string): GainNode {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioMixer requires AudioContext before scheduling");
    }

    const existing = this.trackGains.get(trackId);
    if (existing) return existing;

    const gain = this.audioContext.createGain();
    gain.connect(this.masterGain);
    this.trackGains.set(trackId, gain);
    return gain;
  }

  private getSourceOffsetSeconds(
    clip: AudioClipDescriptor,
    timelineMs: number
  ): number {
    const playheadInsideClipMs = Math.max(0, timelineMs - clip.startMs);
    return (clip.trimStartMs + playheadInsideClipMs * clip.speed) / 1000;
  }

  private getRemainingSourceDurationSeconds(
    clip: AudioClipDescriptor,
    timelineMs: number,
    bufferDurationSec?: number
  ): number {
    const remainingTimelineMs =
      clip.durationMs - Math.max(0, timelineMs - clip.startMs);
    const desiredSourceSec = Math.max(
      0,
      (remainingTimelineMs * clip.speed) / 1000
    );
    const sourceMaxSec =
      clip.sourceMaxDurationMs != null && clip.sourceMaxDurationMs > 0
        ? clip.sourceMaxDurationMs / 1000
        : bufferDurationSec;

    if (sourceMaxSec == null) return desiredSourceSec;

    const currentOffsetSec = this.getSourceOffsetSeconds(clip, timelineMs);
    return Math.max(
      0,
      Math.min(desiredSourceSec, sourceMaxSec - currentOffsetSec)
    );
  }

  private getTimelinePlaybackWindow(
    clip: AudioClipDescriptor,
    timelineMs: number
  ): TimelinePlaybackWindow {
    const startDelayMs = Math.max(0, clip.startMs - timelineMs);
    const clipEndMs = clip.startMs + clip.durationMs;
    return {
      startDelayMs,
      remainingTimelineMs: Math.max(0, clipEndMs - timelineMs),
    };
  }

  private getContextStartTimeForClip(
    clip: AudioClipDescriptor,
    timelineMs: number
  ): number {
    return (
      this.playStartContextTime +
      Math.max(0, (clip.startMs - timelineMs) / 1000)
    );
  }

  private getAudibleContextTime(): number {
    if (!this.audioContext) return 0;
    return this.audioContext.currentTime - (this.audioContext.baseLatency ?? 0);
  }

  private async resumeAudioContext(): Promise<void> {
    if (!this.audioContext || this.audioContext.state !== "suspended") return;
    await this.audioContext.resume().catch(() => {});
  }

  private isCurrentSchedule(generation: number): boolean {
    return this.isPlaying && generation === this.scheduleGeneration;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private stopAllSources(): void {
    // Every stop invalidates async decode completions and Safari timers.
    this.scheduleGeneration += 1;

    for (const source of this.scheduledSources.values()) {
      this.stopSource(source);
    }

    this.scheduledSources.clear();
  }

  private stopSource(source: ScheduledSource): void {
    try {
      if (source.startTimerId != null) {
        clearTimeout(source.startTimerId);
      }
      if (source.endTimerId != null) {
        clearTimeout(source.endTimerId);
      }
      source.bufferSource?.stop();
      source.bufferSource?.disconnect();
      source.mediaElement?.pause();
      source.mediaElementSource?.disconnect();
      source.gainNode.disconnect();
    } catch {
      // Best-effort teardown; stale browser nodes may already be detached.
    }
  }
}

function isAudioBearingTrack(trackType: Track["type"]): boolean {
  return (
    trackType === "video" || trackType === "audio" || trackType === "music"
  );
}

function detectSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function getAudioContextCtor(): (new () => AudioContext) | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}
