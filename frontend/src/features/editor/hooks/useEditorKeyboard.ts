import { useEffect, useRef } from "react";
import type { EditorStore } from "./useEditorStore";
import type { SaveService } from "../services/save-service";
import { isMediaClip } from "../utils/clip-types";

export function useEditorKeyboard(options: {
  store: EditorStore;
  saveService: SaveService;
  removeClip: (clipId: string) => void;
  rippleDeleteClip: (clipId: string) => void;
}): void {
  const { store, saveService, removeClip, rippleDeleteClip } = options;

  const kbStateRef = useRef(store.state);
  kbStateRef.current = store.state;
  const kbStoreRef = useRef(store);
  kbStoreRef.current = store;
  const kbRemoveClipRef = useRef(removeClip);
  kbRemoveClipRef.current = removeClip;
  const kbRippleDeleteRef = useRef(rippleDeleteClip);
  kbRippleDeleteRef.current = rippleDeleteClip;
  const kbSaveServiceRef = useRef(saveService);
  kbSaveServiceRef.current = saveService;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const s = kbStateRef.current;
      const st = kbStoreRef.current;

      if (e.code === "Space") {
        e.preventDefault();
        st.setPlaying(!s.isPlaying);
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        st.setCurrentTime(Math.max(0, s.currentTimeMs - 1000 / s.fps));
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        st.setCurrentTime(Math.min(s.durationMs, s.currentTimeMs + 1000 / s.fps));
      }

      if (e.code === "KeyJ" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const newRate =
          s.isPlaying && s.playbackRate < 0
            ? Math.max(s.playbackRate * 2, -8)
            : -1;
        st.setPlaybackRate(newRate);
        st.setPlaying(true);
      }
      if (e.code === "KeyK" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        st.setPlaying(false);
        st.setPlaybackRate(1);
      }
      if (e.code === "KeyL" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const newRate =
          s.isPlaying && s.playbackRate > 0
            ? Math.min(s.playbackRate * 2, 8)
            : 1;
        st.setPlaybackRate(newRate);
        st.setPlaying(true);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        st.redo();
      }

      if (e.code === "Delete" || e.code === "Backspace") {
        if (s.selectedClipId) {
          e.preventDefault();
          if (e.shiftKey) {
            kbRippleDeleteRef.current(s.selectedClipId);
          } else {
            kbRemoveClipRef.current(s.selectedClipId);
          }
        }
      }

      if (e.code === "Escape") {
        st.selectClip(null);
      }

      if (e.code === "KeyS" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) {
          e.preventDefault();
          st.splitClip(s.selectedClipId, s.currentTimeMs);
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        if (s.selectedClipId) {
          e.preventDefault();
          st.duplicateClip(s.selectedClipId);
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!s.isReadOnly) {
          void kbSaveServiceRef.current.flushNow();
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        if (s.selectedClipId) {
          e.preventDefault();
          st.copyClip(s.selectedClipId);
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        if (s.clipboardClip) {
          e.preventDefault();
          const ownerTrack = s.tracks.find((t) =>
            t.clips.some((c) => c.id === s.clipboardClip?.id)
          );
          const trackId =
            s.clipboardSourceTrackId ?? ownerTrack?.id ?? "video";
          st.pasteClip(trackId, s.currentTimeMs);
        }
      }

      if (e.code === "BracketLeft" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) {
          const clip = s.tracks
            .flatMap((t) => t.clips)
            .find((c) => c.id === s.selectedClipId);
          if (
            clip &&
            isMediaClip(clip) &&
            s.currentTimeMs > clip.startMs &&
            s.currentTimeMs < clip.startMs + clip.durationMs
          ) {
            e.preventDefault();
            const delta = s.currentTimeMs - clip.startMs;
            st.updateClip(clip.id, {
              startMs: s.currentTimeMs,
              trimStartMs: clip.trimStartMs + delta,
              durationMs: clip.durationMs - delta,
            });
          }
        }
      }

      if (e.code === "BracketRight" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) {
          const clip = s.tracks
            .flatMap((t) => t.clips)
            .find((c) => c.id === s.selectedClipId);
          if (
            clip &&
            isMediaClip(clip) &&
            s.currentTimeMs > clip.startMs &&
            s.currentTimeMs < clip.startMs + clip.durationMs
          ) {
            e.preventDefault();
            const newDurationMs = s.currentTimeMs - clip.startMs;
            st.updateClip(clip.id, {
              durationMs: newDurationMs,
              trimEndMs: Math.max(
                0,
                (clip.trimEndMs ?? 0) + clip.durationMs - newDurationMs
              ),
            });
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
