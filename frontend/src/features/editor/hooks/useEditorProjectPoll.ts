import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { EditProject, Track } from "../types/editor";
import type { EditorStore } from "./useEditorStore";
import { isMediaClip, isVideoClip } from "../utils/clip-types";

/**
 * Polls the canonical editor project while placeholders exist, merges non-conflicting
 * server updates, and surfaces script-iteration conflicts (server placeholders vs local real clips).
 */
export function useEditorProjectPoll(options: {
  project: EditProject;
  store: EditorStore;
}) {
  const { project, store } = options;
  const [pollIntervalMs, setPollIntervalMs] = useState(2000);
  const [scriptResetPending, setScriptResetPending] = useState<EditProject | null>(
    null
  );
  const lastHandledServerUpdatedAt = useRef(project.updatedAt);
  const storeRef = useRef(store);
  storeRef.current = store;

  const hasPlaceholders =
    store.state.tracks
      .find((t) => t.type === "video")
      ?.clips.some((c) => isVideoClip(c) && c.isPlaceholder) ?? false;

  useEffect(() => {
    if (!hasPlaceholders) setPollIntervalMs(2000);
  }, [hasPlaceholders]);

  const projectFetcher = useQueryFetcher<{ project: EditProject }>();
  const { data: polledPayload } = useQuery({
    queryKey: queryKeys.api.editorProject(project.id),
    queryFn: () => projectFetcher(`/api/editor/${project.id}`),
    enabled: !!project.id,
    refetchInterval: hasPlaceholders ? pollIntervalMs : false,
  });

  useEffect(() => {
    store.loadProject(project);
    lastHandledServerUpdatedAt.current = project.updatedAt;
  }, [project.id]);

  useEffect(() => {
    const serverP = polledPayload?.project;
    if (!serverP) return;
    if (serverP.updatedAt === lastHandledServerUpdatedAt.current) return;

    setPollIntervalMs((p) => Math.min(p * 2, 15000));

    const serverVideo = serverP.tracks.find((t) => t.type === "video");
    const localVideo = storeRef.current.state.tracks.find(
      (t) => t.type === "video"
    );
    const serverAllPlaceholders =
      !!serverVideo &&
      serverVideo.clips.length > 0 &&
      serverVideo.clips.every((c) => isVideoClip(c) && c.isPlaceholder);
    const localHasRealClip = localVideo?.clips.some(
      (c) => isVideoClip(c) && Boolean(c.assetId) && !c.isPlaceholder
    );

    if (serverAllPlaceholders && localHasRealClip) {
      setScriptResetPending(serverP);
      return;
    }

    lastHandledServerUpdatedAt.current = serverP.updatedAt;
    storeRef.current.dispatch({
      type: "MERGE_TRACKS_FROM_SERVER",
      tracks: serverP.tracks as Track[],
    });
  }, [polledPayload?.project]);

  const onScriptIterationDialogOpenChange = useCallback((open: boolean) => {
    if (open) return;
    setScriptResetPending((pending) => {
      if (pending) {
        lastHandledServerUpdatedAt.current = pending.updatedAt;
      }
      return null;
    });
  }, []);

  const confirmScriptIteration = useCallback(() => {
    setScriptResetPending((pending) => {
      if (!pending) return null;
      lastHandledServerUpdatedAt.current = pending.updatedAt;
      store.loadProject(pending);
      return null;
    });
  }, [store]);

  return {
    scriptResetPending,
    onScriptIterationDialogOpenChange,
    confirmScriptIteration,
  };
}
