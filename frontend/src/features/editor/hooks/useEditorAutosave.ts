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
import { invalidateEditorProjectsQueries } from "@/shared/lib/query-invalidation";
import { stripLocallyModifiedFromTracks } from "../utils/strip-local-editor-fields";

/** Latest editor fields we would send in a full patch (tracks + metadata). */
export interface EditorPublishSnapshot {
  tracks: Track[];
  durationMs: number;
  title: string;
  resolution: string;
  fps: number;
}

/** Last PATCH-shaped snapshot the server accepted; avoids treating new array identity as an edit. */
function persistFingerprint(snapshot: EditorPublishSnapshot): string {
  return JSON.stringify({
    tracks: stripLocallyModifiedFromTracks(snapshot.tracks),
    durationMs: snapshot.durationMs,
    title: snapshot.title,
    resolution: snapshot.resolution,
    fps: snapshot.fps,
  });
}

type SaveRequest = {
  patch: PatchProjectParams;
  sentFingerprint: string | null;
};

/**
 * Debounced PATCH autosave for the editor project: tracks/title/duration and
 * resolution/fps, plus periodic flush while dirty, unload flush, and unmount flush.
 */
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
  /** Wall-clock time of the last successful PATCH (for UI). */
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  /** True after local edits until the server confirms a save. */
  const [isDirty, setIsDirty] = useState(false);

  /** Pending debounced save; cleared on flush/unmount/unload. */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mirrors mutation pending so interval/unload logic avoids overlapping saves. */
  const isSavingPatchRef = useRef(false);
  /** Latest read-only flag for effects/cleanup that cannot close over stale props. */
  const isReadOnlyRef = useRef(isReadOnly);
  /** Latest dirty flag for the interval effect (avoids stale closure). */
  const isDirtyRef = useRef(isDirty);
  /** Set on 404 so we stop firing saves after the project is gone. */
  const projectDeletedRef = useRef(false);
  isReadOnlyRef.current = isReadOnly;
  isDirtyRef.current = isDirty;

  /** Always holds the newest snapshot for full flushes (interval, unload, unmount). */
  const editorPublishStateRef = useRef<EditorPublishSnapshot>({
    tracks,
    durationMs,
    title,
    resolution,
    fps,
  });
  editorPublishStateRef.current = {
    tracks,
    durationMs,
    title,
    resolution,
    fps,
  };

  /** Fingerprint last confirmed by a successful PATCH; survives new array instances for same data. */
  const baselinePersistFingerprintRef = useRef<string>(
    persistFingerprint(editorPublishStateRef.current)
  );

  // queueSave: debounced fire-and-forget. flushSave: awaitable full snapshot (interval / unload / unmount).
  const {
    mutate: queueSaveMutation,
    mutateAsync: flushSaveMutation,
    isPending: isSavingPatch,
  } = useMutation({
    mutationFn: ({ patch }: SaveRequest) =>
      patchEditorProject(projectId, patch),
    onSuccess: (_data, request) => {
      // Align UI with server; refresh editor list caches so other surfaces see the new version.
      setLastSavedAt(new Date());
      if (request.sentFingerprint) {
        baselinePersistFingerprintRef.current = request.sentFingerprint;
        const currentFp = persistFingerprint(editorPublishStateRef.current);
        if (currentFp === request.sentFingerprint) {
          setIsDirty(false);
        }
      } else {
        baselinePersistFingerprintRef.current = persistFingerprint(
          editorPublishStateRef.current
        );
        setIsDirty(false);
      }
      void invalidateEditorProjectsQueries(queryClient);
    },
    onError: (error: unknown) => {
      const status = (error as { status?: number }).status;
      if (status === 404) {
        // Stop follow-up saves; project is gone.
        projectDeletedRef.current = true;
        toast.error("This project was deleted.");
        return;
      }
      if (status === 409) {
        // Server version != expectedVersion; user must reload.
        toast.error("Version conflict. Refresh to load the latest project.");
        return;
      }
      toast.error("Failed to save editor changes.");
    },
  });

  isSavingPatchRef.current = isSavingPatch;

  const queueSaveWithFingerprint = useCallback(
    (patch: PatchProjectParams, sentFingerprint: string | null) => {
      queueSaveMutation({
        patch,
        sentFingerprint,
      });
    },
    [queueSaveMutation]
  );

  const flushSave = useCallback(
    (patch: PatchProjectParams) =>
      flushSaveMutation({
        patch,
        sentFingerprint: null,
      }),
    [flushSaveMutation]
  );

  /** Reset debounce timer and PATCH after `EDITOR_AUTOSAVE_DEBOUNCE_MS`. */
  const scheduleSave = useCallback(
    (patch: PatchProjectParams, sentFingerprint?: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(
        () => queueSaveWithFingerprint(patch, sentFingerprint ?? null),
        EDITOR_AUTOSAVE_DEBOUNCE_MS
      );
    },
    [queueSaveWithFingerprint]
  );

  // On unmount: cancel debounce; if still editable and project exists, send one last PATCH.
  useEffect(() => {
    return () => {
      if (!saveTimerRef.current) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (isReadOnlyRef.current || projectDeletedRef.current) return;
      const snap = editorPublishStateRef.current;
      queueSaveWithFingerprint(
        {
          tracks: stripLocallyModifiedFromTracks(snap.tracks),
          durationMs: snap.durationMs,
          title: snap.title,
          resolution: snap.resolution,
          fps: snap.fps,
        },
        persistFingerprint(snap)
      );
    };
  }, [queueSaveWithFingerprint]);

  // New project tab: baseline matches loaded snapshot; do not treat as unsaved.
  useEffect(() => {
    baselinePersistFingerprintRef.current = persistFingerprint(
      editorPublishStateRef.current
    );
    setIsDirty(false);
  }, [projectId]);

  // Persisted-shape document changed (not just new object identity) → dirty + debounced full patch.
  useEffect(() => {
    const snap = editorPublishStateRef.current;
    const nextFp = persistFingerprint(snap);
    if (nextFp === baselinePersistFingerprintRef.current) return;
    if (!isReadOnly) {
      setIsDirty(true);
      scheduleSave(
        {
          tracks: stripLocallyModifiedFromTracks(snap.tracks),
          durationMs: snap.durationMs,
          title: snap.title,
          resolution: snap.resolution,
          fps: snap.fps,
        },
        nextFp
      );
    }
  }, [tracks, durationMs, title, resolution, fps, isReadOnly, scheduleSave]);

  // While dirty, periodically flush a full snapshot so long-lived sessions don’t stall on debounce-only saves.
  useEffect(() => {
    const id = setInterval(() => {
      if (
        !isReadOnlyRef.current &&
        !projectDeletedRef.current &&
        isDirtyRef.current &&
        !isSavingPatchRef.current
      ) {
        const snap = editorPublishStateRef.current;
        void flushSaveMutation({
          patch: {
            tracks: stripLocallyModifiedFromTracks(snap.tracks),
            durationMs: snap.durationMs,
            title: snap.title,
            resolution: snap.resolution,
            fps: snap.fps,
          },
          sentFingerprint: persistFingerprint(snap),
        });
      }
    }, EDITOR_AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flushSaveMutation]);

  // Tab close/refresh: browser “leave site?” prompt if dirty; clear debounce and attempt immediate flush.
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasPendingDebounce = saveTimerRef.current !== null;
      if (
        isReadOnlyRef.current ||
        (!isDirtyRef.current && !hasPendingDebounce)
      ) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const snap = editorPublishStateRef.current;
      void flushSaveMutation({
        patch: {
          tracks: stripLocallyModifiedFromTracks(snap.tracks),
          durationMs: snap.durationMs,
          title: snap.title,
          resolution: snap.resolution,
          fps: snap.fps,
        },
        sentFingerprint: persistFingerprint(snap),
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flushSaveMutation]);

  return {
    /** Time of last successful PATCH, or null before the first save. */
    lastSavedAt,
    /** True when local state may differ from last confirmed server save. */
    isDirty,
    /** True while a PATCH request is in flight. */
    isSavingPatch,
    /** Debounced save entry point (e.g. callers that build their own partial patch). */
    scheduleSave,
    /** Immediate full-snapshot save (awaitable). */
    flushSave,
    /** Exposed so the host can cancel pending debounce on explicit save if needed. */
    saveTimerRef,
    /** Exposed so publish/export can read the latest tracks + metadata without extra state. */
    editorPublishStateRef,
  };
}
