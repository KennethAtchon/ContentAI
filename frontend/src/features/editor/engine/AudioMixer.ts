/* global Audio, AudioBuffer, AudioBufferSourceNode, GainNode, MediaElementAudioSourceNode */

import type { Track } from "../types/editor";
import { isMediaClip } from "../utils/clip-types";

const AUDIO_CLOCK_PUBLISH_FLOOR_MS = 0;

function detectSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function getAudioContextCtor():
  | (new () => AudioContext)
  | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

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
}

export function buildAudioClipDescriptors(
  tracks: Track[],
  assetUrlMap: Map<string, string>
): AudioClipDescriptor[] {
  const descriptors: AudioClipDescriptor[] = [];

  for (const track of tracks) {
    if (
      track.type !== "video" &&
      track.type !== "audio" &&
      track.type !== "music"
    ) {
      continue;
    }

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
  private readonly audioContext: AudioContext | null;
  private readonly masterGain: GainNode | null;
  private readonly isSafari = detectSafari();
  private readonly trackGains = new Map<string, GainNode>();
  private readonly scheduledSources = new Map<string, ScheduledSource>();
  private readonly decodedBufferCache = new Map<string, Promise<AudioBuffer>>();

  private playStartContextTime = 0;
  private playStartTimelineMs = 0;
  private isPlaying = false;
  private scheduleGeneration = 0;

  constructor() {
    const AudioContextCtor = getAudioContextCtor();
    this.audioContext = AudioContextCtor ? new AudioContextCtor() : null;
    this.masterGain = this.audioContext?.createGain() ?? null;
    this.masterGain?.connect(this.audioContext!.destination);
  }

  async prime(): Promise<void> {
    if (!this.audioContext || this.audioContext.state !== "suspended") return;
    await this.audioContext.resume().catch(() => {});
  }

  getAudibleTimeMs(): number {
    if (!this.audioContext || !this.isPlaying) {
      return Math.max(AUDIO_CLOCK_PUBLISH_FLOOR_MS, this.playStartTimelineMs);
    }

    const audibleContextTime =
      this.audioContext.currentTime - (this.audioContext.baseLatency ?? 0);
    const elapsedMs = (audibleContextTime - this.playStartContextTime) * 1000;
    return Math.max(
      AUDIO_CLOCK_PUBLISH_FLOOR_MS,
      this.playStartTimelineMs + elapsedMs
    );
  }

  async play(
    timelineMs: number,
    clips: AudioClipDescriptor[]
  ): Promise<void> {
    if (!this.audioContext) {
      this.playStartTimelineMs = timelineMs;
      this.isPlaying = true;
      return;
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume().catch(() => {});
    }

    this.stopAllSources();
    this.scheduleGeneration += 1;
    const generation = this.scheduleGeneration;

    this.playStartTimelineMs = timelineMs;
    this.playStartContextTime =
      this.audioContext.currentTime - (this.audioContext.baseLatency ?? 0);
    this.isPlaying = true;

    await Promise.all(
      clips.map(async (clip) => {
        if (clip.muted || clip.trackMuted) return;

        const clipEndMs = clip.startMs + clip.durationMs;
        if (timelineMs >= clipEndMs) return;

        const trackGain = this.getOrCreateTrackGain(clip.trackId);
        trackGain.gain.setValueAtTime(
          clip.trackMuted ? 0 : 1,
          this.audioContext!.currentTime
        );

        if (this.isSafari) {
          await this.scheduleSafariAudio(clip, timelineMs, trackGain, generation);
        } else {
          await this.scheduleBufferSourceAudio(
            clip,
            timelineMs,
            trackGain,
            generation
          );
        }
      })
    );
  }

  pause(): void {
    if (!this.isPlaying) return;

    this.playStartTimelineMs = this.getAudibleTimeMs();
    this.isPlaying = false;
    this.stopAllSources();

    if (this.audioContext && this.audioContext.state === "running") {
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

    this.decodedBufferCache.set(assetUrl, pending);
    return pending;
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
    const currentOffsetSec = this.getSourceOffsetSeconds(clip, timelineMs);

    if (sourceMaxSec == null) return desiredSourceSec;
    return Math.max(0, Math.min(desiredSourceSec, sourceMaxSec - currentOffsetSec));
  }

  private async scheduleBufferSourceAudio(
    clip: AudioClipDescriptor,
    timelineMs: number,
    trackGain: GainNode,
    generation: number
  ): Promise<void> {
    if (!this.audioContext) return;

    let buffer: AudioBuffer;
    try {
      buffer = await this.getDecodedBuffer(clip.assetUrl);
    } catch (error) {
      console.warn(
        `[AudioMixer] Failed to decode audio for clip ${clip.clipId}:`,
        error
      );
      return;
    }

    if (!this.isPlaying || generation !== this.scheduleGeneration) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = clip.speed;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = clip.volume;
    source.connect(gainNode);
    gainNode.connect(trackGain);

    const offsetSec = this.getSourceOffsetSeconds(clip, timelineMs);
    const durationSec = this.getRemainingSourceDurationSeconds(
      clip,
      timelineMs,
      buffer.duration
    );

    if (durationSec <= 0 || offsetSec >= buffer.duration) {
      gainNode.disconnect();
      return;
    }

    const contextStartTime =
      this.playStartContextTime +
      Math.max(0, (clip.startMs - timelineMs) / 1000);

    source.start(contextStartTime, offsetSec, durationSec);

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

    if (!this.isPlaying || generation !== this.scheduleGeneration) {
      source.disconnect();
      gainNode.disconnect();
      return;
    }

    let startTimerId: number | undefined;
    const startPlayback = () => {
      if (!this.isPlaying || generation !== this.scheduleGeneration) return;
      void audio.play().catch(() => {});
    };

    if (clip.startMs <= timelineMs) {
      startPlayback();
    } else {
      startTimerId = window.setTimeout(
        startPlayback,
        Math.max(0, clip.startMs - timelineMs)
      );
    }

    this.scheduledSources.set(clip.clipId, {
      clipId: clip.clipId,
      mediaElement: audio,
      mediaElementSource: source,
      gainNode,
      startTimerId,
    });
  }

  private stopAllSources(): void {
    this.scheduleGeneration += 1;

    for (const [, source] of this.scheduledSources) {
      try {
        if (source.startTimerId != null) {
          clearTimeout(source.startTimerId);
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

    this.scheduledSources.clear();
  }
}
