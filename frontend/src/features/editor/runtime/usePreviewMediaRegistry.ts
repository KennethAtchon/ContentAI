import { useCallback, useEffect, useRef } from "react";

/**
 * Owns the live DOM registries for mounted preview media elements.
 *
 * The preview runtime needs stable access to the currently mounted `<video>` and
 * `<audio>` nodes so sync logic can update them without pushing those refs
 * through every renderer layer. This hook also prunes stale entries when clips
 * unmount, keeping the registry aligned with the active preview scene.
 */
export function usePreviewMediaRegistry(videoClipIds: string[], audioClipIds: string[]) {
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const registerVideoRef = useCallback((clipId: string, element: HTMLVideoElement | null) => {
    if (element) videoRefs.current.set(clipId, element);
    else videoRefs.current.delete(clipId);
  }, []);

  const registerAudioRef = useCallback((clipId: string, element: HTMLAudioElement | null) => {
    if (element) audioRefs.current.set(clipId, element);
    else audioRefs.current.delete(clipId);
  }, []);

  useEffect(() => {
    const currentVideoClipIds = new Set(videoClipIds);
    const currentAudioClipIds = new Set(audioClipIds);

    for (const id of videoRefs.current.keys()) {
      if (!currentVideoClipIds.has(id)) videoRefs.current.delete(id);
    }

    for (const id of audioRefs.current.keys()) {
      if (!currentAudioClipIds.has(id)) audioRefs.current.delete(id);
    }
  }, [audioClipIds, videoClipIds]);

  return {
    audioRefs,
    registerAudioRef,
    registerVideoRef,
    videoRefs,
  };
}
