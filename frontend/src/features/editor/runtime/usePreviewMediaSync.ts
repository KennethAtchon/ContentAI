import { useEffect, useRef } from "react";
import type { Track } from "../types/editor";
import {
  effectiveHtmlMediaPlaybackRate,
  getClipSourceTimeSecondsAtTimelineTime,
  isClipActiveAtTimelineTime,
  isIncomingDissolveOrWipePrerenderWindow,
  VIDEO_INCOMING_TRANSITION_SEEK_THRESHOLD_SEC,
  VIDEO_SYNC_SEEK_THRESHOLD_SEC,
} from "../utils/editor-composition";
import { isMediaClip, isVideoClip } from "../utils/clip-types";

type VideoFrameRequestCallback = (
  callback: (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => void
) => number;
type CancelVideoFrameRequestCallback = (handle: number) => void;

interface UsePreviewMediaSyncParams {
  audioRefs: React.MutableRefObject<Map<string, HTMLAudioElement>>;
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  tracks: Track[];
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}

/**
 * Synchronizes mounted HTML media elements with the preview-local playhead.
 *
 * This hook exists to keep imperative media behavior out of the render tree:
 * React describes which elements should exist, while this runtime hook handles
 * seeking, play/pause, playback rate changes, volume/mute state, and
 * transition prerender windows.
 *
 * For video, it prefers `requestVideoFrameCallback` when available so sync
 * work tracks decoded frames instead of React's render cadence. Audio uses the
 * same preview clock with an immediate effect-based sync path because browsers
 * do not expose the same primitive for audio elements.
 */
export function usePreviewMediaSync({
  audioRefs,
  currentTimeMs,
  isPlaying,
  playbackRate,
  tracks,
  videoRefs,
}: UsePreviewMediaSyncParams) {
  const videoFrameHandlesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    for (const track of tracks.filter((item) => item.type === "video")) {
      const trackTransitions = track.transitions ?? [];
      const trackClips = track.clips.filter(isVideoClip);
      const activeIds = new Set(
        trackClips
          .filter((clip) => isClipActiveAtTimelineTime(clip, currentTimeMs))
          .map((clip) => clip.id)
      );

      for (const clip of trackClips) {
        const element = videoRefs.current.get(clip.id);
        if (!element) continue;

        const isActive = activeIds.has(clip.id);
        const isIncomingWindow = isIncomingDissolveOrWipePrerenderWindow(
          clip,
          trackTransitions,
          trackClips,
          currentTimeMs
        );

        const syncElement = () => {
          if (isActive) {
            const targetTime = getClipSourceTimeSecondsAtTimelineTime(
              clip,
              currentTimeMs
            );
            if (
              Math.abs(element.currentTime - targetTime) >
              VIDEO_SYNC_SEEK_THRESHOLD_SEC
            ) {
              element.currentTime = targetTime;
            }
            element.playbackRate = effectiveHtmlMediaPlaybackRate(
              playbackRate,
              clip.speed || 1
            );
            element.volume = Math.min(1, Math.max(0, clip.volume ?? 1));
            element.muted = (clip.muted ?? false) || track.muted;
            if (isPlaying && element.paused) element.play().catch(() => {});
            if (!isPlaying && !element.paused) element.pause();
            return;
          }

          if (isIncomingWindow) {
            const targetTime = clip.trimStartMs / 1000;
            if (
              Math.abs(element.currentTime - targetTime) >
              VIDEO_INCOMING_TRANSITION_SEEK_THRESHOLD_SEC
            ) {
              element.currentTime = targetTime;
            }
            element.playbackRate = effectiveHtmlMediaPlaybackRate(
              playbackRate,
              clip.speed || 1
            );
            // Incoming prerender windows should prepare frames, not leak early audio.
            element.volume = Math.min(1, Math.max(0, clip.volume ?? 1));
            element.muted = true;
            if (isPlaying && element.paused) element.play().catch(() => {});
            if (!isPlaying && !element.paused) element.pause();
            return;
          }

          element.muted = true;
          if (!element.paused) element.pause();
        };

        const requestFrame = (
          element.requestVideoFrameCallback as VideoFrameRequestCallback | undefined
        )?.bind(element);
        if (isPlaying && requestFrame) {
          const cancelFrame = (
            element.cancelVideoFrameCallback as CancelVideoFrameRequestCallback | undefined
          )?.bind(element);
          const existingHandle = videoFrameHandlesRef.current.get(clip.id);
          if (existingHandle !== undefined && cancelFrame) {
            cancelFrame(existingHandle);
          }
          syncElement();
          const handle = requestFrame(() => syncElement());
          videoFrameHandlesRef.current.set(clip.id, handle);
        } else {
          syncElement();
        }
      }
    }

    return () => {
      for (const track of tracks.filter((item) => item.type === "video")) {
        for (const clip of track.clips.filter(isVideoClip)) {
          const element = videoRefs.current.get(clip.id);
          const handle = videoFrameHandlesRef.current.get(clip.id);
          const cancelFrame = (
            element?.cancelVideoFrameCallback as
              | CancelVideoFrameRequestCallback
              | undefined
          )?.bind(element);
          if (cancelFrame && handle !== undefined) {
            cancelFrame(handle);
          }
        }
      }
      videoFrameHandlesRef.current.clear();
    };
  }, [currentTimeMs, isPlaying, playbackRate, tracks, videoRefs]);

  useEffect(() => {
    const runForTrack = (track: Track | undefined) => {
      if (!track) return;

      for (const clip of track.clips.filter(isMediaClip)) {
        const element = audioRefs.current.get(clip.id);
        if (!element) continue;
        const isActive = isClipActiveAtTimelineTime(clip, currentTimeMs);

        if (isActive) {
          const targetTime = getClipSourceTimeSecondsAtTimelineTime(
            clip,
            currentTimeMs
          );
          if (
            Math.abs(element.currentTime - targetTime) >
            VIDEO_SYNC_SEEK_THRESHOLD_SEC
          ) {
            element.currentTime = targetTime;
          }
          element.playbackRate = effectiveHtmlMediaPlaybackRate(
            playbackRate,
            clip.speed || 1
          );
          element.volume = Math.min(1, Math.max(0, clip.volume ?? 1));
          element.muted = (clip.muted ?? false) || track.muted;
          if (isPlaying && element.paused) element.play().catch(() => {});
          if (!isPlaying && !element.paused) element.pause();
        } else if (!element.paused) {
          element.pause();
        }
      }
    };

    runForTrack(tracks.find((track) => track.type === "audio"));
    runForTrack(tracks.find((track) => track.type === "music"));
  }, [audioRefs, currentTimeMs, isPlaying, playbackRate, tracks]);
}
