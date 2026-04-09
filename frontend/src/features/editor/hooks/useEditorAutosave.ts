import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Track } from "../types/editor";
import {
  EDITOR_AUTOSAVE_DEBOUNCE_MS,
  EDITOR_AUTOSAVE_INTERVAL_MS,
} from "../constants/editor";
import {
  patchEditorProject,
  type PatchProjectParams,
} from "../services/editor-api";
import {
  invalidateEditorProjectQuery,
  invalidateEditorProjectsQueries,
} from "@/shared/lib/query-invalidation";
import { stripLocallyModifiedFromTracks } from "../utils/strip-local-editor-fields";

export interface EditorPublishSnapshot {
  tracks: Track[];
  durationMs: number;
  title: string;
  resolution: string;
  fps: number;
}

export function useEditorAutosave(options: {
  projectId: string;
  isReadOnly: boolean;
  tracks: Track[];
  durationMs: number;
  title: string;
  resolution: string;
  fps: number;
}) {
  const { projectId, isReadOnly, tracks, durationMs, title, resolution, fps } =
    options;
  const queryClient = useQueryClient();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingPatchRef = useRef(false);
  const isReadOnlyRef = useRef(isReadOnly);
  const isDirtyRef = useRef(isDirty);
  const projectDeletedRef = useRef(false);
  isReadOnlyRef.current = isReadOnly;
  isDirtyRef.current = isDirty;

  const editorPublishStateRef = useRef<EditorPublishSnapshot>({
    tracks,
    durationMs,
    title,
    resolution,
    fps,
  });
  editorPublishStateRef.current = { tracks, durationMs, title, resolution, fps };

  const {
    mutate: queueSave,
    mutateAsync: flushSave,
    isPending: isSavingPatch,
  } = useMutation({
    mutationFn: (patch: PatchProjectParams) =>
      patchEditorProject(projectId, patch),
    onSuccess: () => {
      setLastSavedAt(new Date());
      setIsDirty(false);
      void Promise.all([
        invalidateEditorProjectsQueries(queryClient),
        invalidateEditorProjectQuery(queryClient, projectId),
      ]);
    },
    onError: (error: unknown) => {
      const status = (error as { status?: number }).status;
      if (status === 404) {
        projectDeletedRef.current = true;
        toast.error("This project was deleted.");
        return;
      }
      if (status === 409) {
        toast.error("Version conflict. Refresh to load the latest project.");
        return;
      }
      toast.error("Failed to save editor changes.");
    },
  });

  isSavingPatchRef.current = isSavingPatch;

  const scheduleSave = useCallback(
    (patch: PatchProjectParams) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(
        () => queueSave(patch),
        EDITOR_AUTOSAVE_DEBOUNCE_MS
      );
    },
    [queueSave]
  );

  useEffect(() => {
    return () => {
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (isReadOnlyRef.current || projectDeletedRef.current) return;
      const snap = editorPublishStateRef.current;
      queueSave({
        tracks: stripLocallyModifiedFromTracks(snap.tracks),
        durationMs: snap.durationMs,
        title: snap.title,
        resolution: snap.resolution,
        fps: snap.fps,
      });
    };
  }, [queueSave]);

  const tracksRef = useRef(tracks);
  useEffect(() => {
    if (tracksRef.current === tracks) return;
    tracksRef.current = tracks;
    if (!isReadOnly) {
      setIsDirty(true);
      scheduleSave({
        tracks: stripLocallyModifiedFromTracks(tracks),
        durationMs,
        title,
      });
    }
  }, [tracks, title, durationMs, isReadOnly, scheduleSave]);

  const resolutionRef = useRef(resolution);
  useEffect(() => {
    if (resolutionRef.current === resolution) return;
    resolutionRef.current = resolution;
    if (!isReadOnly) {
      setIsDirty(true);
      scheduleSave({ resolution });
    }
  }, [resolution, isReadOnly, scheduleSave]);

  const fpsRef = useRef(fps);
  useEffect(() => {
    if (fpsRef.current === fps) return;
    fpsRef.current = fps;
    if (!isReadOnly) {
      setIsDirty(true);
      scheduleSave({ fps });
    }
  }, [fps, isReadOnly, scheduleSave]);

  useEffect(() => {
    const id = setInterval(() => {
      if (
        !isReadOnlyRef.current &&
        !projectDeletedRef.current &&
        isDirtyRef.current &&
        !isSavingPatchRef.current
      ) {
        const snap = editorPublishStateRef.current;
        void flushSave({
          tracks: stripLocallyModifiedFromTracks(snap.tracks),
          durationMs: snap.durationMs,
          title: snap.title,
          resolution: snap.resolution,
          fps: snap.fps,
        });
      }
    }, EDITOR_AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flushSave]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isReadOnlyRef.current || !isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const snap = editorPublishStateRef.current;
      void flushSave({
        tracks: stripLocallyModifiedFromTracks(snap.tracks),
        durationMs: snap.durationMs,
        title: snap.title,
        resolution: snap.resolution,
        fps: snap.fps,
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flushSave]);

  return {
    lastSavedAt,
    isDirty,
    isSavingPatch,
    scheduleSave,
    flushSave,
    saveTimerRef,
    editorPublishStateRef,
  };
}
