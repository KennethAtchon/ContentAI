import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { EditorShell } from "@/features/video/components/editor/EditorShell";
import { useAutosaveComposition } from "@/features/video/hooks/use-autosave-composition";
import { useComposition } from "@/features/video/hooks/use-composition";
import { useInitComposition } from "@/features/video/hooks/use-init-composition";
import type {
  CompositionRecord,
  EditorSelection,
  Timeline,
} from "@/features/video/types/composition.types";
import { normalizeTimeline, splitVideoItemAt } from "@/features/video/utils/timeline-utils";

function ReelEditorRoute() {
  const { t } = useTranslation();
  const params = Route.useParams();
  const generatedContentId = Number(params.generatedContentId);
  const isValidDraftId =
    Number.isFinite(generatedContentId) && generatedContentId > 0;
  const initComposition = useInitComposition();
  const hasInitializedRef = useRef(false);
  const [compositionId, setCompositionId] = useState<string | null>(null);
  const [editableComposition, setEditableComposition] =
    useState<CompositionRecord | null>(null);
  const [selection, setSelection] = useState<EditorSelection>({
    videoClipId: null,
    textOverlayId: null,
  });
  const [pastTimelines, setPastTimelines] = useState<Timeline[]>([]);
  const [futureTimelines, setFutureTimelines] = useState<Timeline[]>([]);

  const runInit = useCallback(
    () =>
      initComposition
        .mutateAsync({ generatedContentId, mode: "quick" })
        .then((data) => setCompositionId(data.compositionId))
        .catch(() => {}),
    [generatedContentId, initComposition],
  );

  useEffect(() => {
    if (hasInitializedRef.current || !isValidDraftId) return;
    hasInitializedRef.current = true;
    void runInit();
  }, [isValidDraftId, runInit]);

  const compositionQuery = useComposition(compositionId);
  useEffect(() => {
    if (!compositionQuery.data) return;
    setEditableComposition(compositionQuery.data);
    setSelection({
      videoClipId: compositionQuery.data.timeline.tracks.video[0]?.id ?? null,
      textOverlayId: null,
    });
    setPastTimelines([]);
    setFutureTimelines([]);
  }, [compositionQuery.data]);

  useEffect(() => {
    if (!editableComposition) return;
    const hasVideoSelection =
      selection.videoClipId === null ||
      editableComposition.timeline.tracks.video.some(
        (item) => item.id === selection.videoClipId,
      );
    const hasTextSelection =
      selection.textOverlayId === null ||
      editableComposition.timeline.tracks.text.some(
        (item) =>
          String((item as Record<string, unknown>).id ?? "") ===
          selection.textOverlayId,
      );
    if (!hasVideoSelection || !hasTextSelection) {
      setSelection((prev) => ({
        videoClipId:
          hasVideoSelection
            ? prev.videoClipId
            : editableComposition.timeline.tracks.video[0]?.id ?? null,
        textOverlayId: hasTextSelection ? prev.textOverlayId : null,
      }));
    }
  }, [editableComposition, selection.textOverlayId, selection.videoClipId]);

  const autosave = useAutosaveComposition({
    compositionId: editableComposition?.compositionId ?? null,
    expectedVersion: editableComposition?.version ?? 1,
    timeline: editableComposition?.timeline ?? null,
    editMode: editableComposition?.editMode ?? "quick",
    onSaved: (nextVersion) => {
      setEditableComposition((prev) =>
        prev
          ? {
              ...prev,
              version: nextVersion,
            }
          : prev,
      );
    },
  });

  const isLoading = initComposition.isPending || compositionQuery.isLoading;
  const errorMessage = useMemo(() => {
    if (!isValidDraftId) return t("phase5_editor_invalid_draft");
    return (
      initComposition.error?.message ??
      compositionQuery.error?.message ??
      null
    );
  }, [
    compositionQuery.error?.message,
    initComposition.error?.message,
    isValidDraftId,
    t,
  ]);

  let content: React.ReactNode = null;
  const handleTimelineChange = useCallback((nextTimeline: Timeline) => {
    setEditableComposition((prev) => {
      if (!prev) return prev;
      const prevHash = JSON.stringify(prev.timeline);
      const nextHash = JSON.stringify(nextTimeline);
      if (prevHash === nextHash) return prev;
      setPastTimelines((items) => [...items.slice(-49), prev.timeline]);
      setFutureTimelines([]);
      return {
        ...prev,
        timeline: nextTimeline,
      };
    });
  }, []);

  const handleUndo = useCallback(() => {
    setPastTimelines((items) => {
      if (items.length === 0) return items;
      const previous = items[items.length - 1];
      setEditableComposition((prev) => {
        if (!prev) return prev;
        setFutureTimelines((future) => [prev.timeline, ...future].slice(0, 50));
        return {
          ...prev,
          timeline: previous,
        };
      });
      return items.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setFutureTimelines((items) => {
      if (items.length === 0) return items;
      const [next, ...rest] = items;
      setEditableComposition((prev) => {
        if (!prev) return prev;
        setPastTimelines((past) => [...past.slice(-49), prev.timeline]);
        return {
          ...prev,
          timeline: next,
        };
      });
      return rest;
    });
  }, []);

  const handleDeleteShortcut = useCallback(() => {
    setEditableComposition((prev) => {
      if (!prev) return prev;
      if (selection.textOverlayId) {
        const nextTimeline = {
          ...prev.timeline,
          tracks: {
            ...prev.timeline.tracks,
            text: prev.timeline.tracks.text.filter(
              (item) =>
                String((item as Record<string, unknown>).id ?? "") !==
                selection.textOverlayId,
            ),
          },
        };
        setPastTimelines((items) => [...items.slice(-49), prev.timeline]);
        setFutureTimelines([]);
        setSelection((current) => ({ ...current, textOverlayId: null }));
        return { ...prev, timeline: nextTimeline };
      }
      if (selection.videoClipId && prev.timeline.tracks.video.length > 1) {
        const nextTimeline = normalizeTimeline({
          ...prev.timeline,
          tracks: {
            ...prev.timeline.tracks,
            video: prev.timeline.tracks.video.filter(
              (item) => item.id !== selection.videoClipId,
            ),
          },
        });
        setPastTimelines((items) => [...items.slice(-49), prev.timeline]);
        setFutureTimelines([]);
        setSelection((current) => ({
          ...current,
          videoClipId: nextTimeline.tracks.video[0]?.id ?? null,
        }));
        return { ...prev, timeline: nextTimeline };
      }
      return prev;
    });
  }, [selection.textOverlayId, selection.videoClipId]);

  const handleSplitShortcut = useCallback(() => {
    setEditableComposition((prev) => {
      if (!prev || !selection.videoClipId) return prev;
      const nextTimeline = splitVideoItemAt(prev.timeline, selection.videoClipId);
      if (nextTimeline === prev.timeline) return prev;
      const nextSelected =
        nextTimeline.tracks.video.find((item) =>
          item.id.startsWith(`${selection.videoClipId}-a-`),
        )?.id ?? nextTimeline.tracks.video[0]?.id ?? null;
      setPastTimelines((items) => [...items.slice(-49), prev.timeline]);
      setFutureTimelines([]);
      setSelection((current) => ({ ...current, videoClipId: nextSelected }));
      return {
        ...prev,
        timeline: nextTimeline,
      };
    });
  }, [selection.videoClipId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as
        | { tagName?: string; isContentEditable?: boolean }
        | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true;
      if (isTypingTarget) return;

      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (isCmdOrCtrl && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (
        isCmdOrCtrl &&
        (event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDeleteShortcut();
        return;
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSplitShortcut();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDeleteShortcut, handleRedo, handleSplitShortcut, handleUndo]);
  if (isLoading) {
    content = (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">
          {t("phase5_editor_loading")}
        </p>
      </div>
    );
  } else if (errorMessage) {
    content = (
      <div className="flex h-full items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-center">
          <p className="text-sm text-red-300">{errorMessage}</p>
          <button
            onClick={() => {
              hasInitializedRef.current = false;
              setCompositionId(null);
              setEditableComposition(null);
              void runInit();
            }}
            className="mt-3 rounded border border-red-300/50 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
          >
            {t("phase5_editor_retry_init")}
          </button>
        </div>
      </div>
    );
  } else if (editableComposition) {
    content = (
      <EditorShell
        generatedContentId={generatedContentId}
        composition={editableComposition}
        saveState={autosave.saveState}
        saveError={autosave.saveError}
        onTimelineChange={handleTimelineChange}
        selectedVideoClipId={selection.videoClipId}
        selectedTextOverlayId={selection.textOverlayId}
        onSelectVideoClip={(clipId) =>
          setSelection((prev) => ({ ...prev, videoClipId: clipId }))
        }
        onSelectTextOverlay={(overlayId) =>
          setSelection((prev) => ({ ...prev, textOverlayId: overlayId }))
        }
        canUndo={pastTimelines.length > 0}
        canRedo={futureTimelines.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    );
  }

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="generate" />
        <div className="min-h-0 overflow-hidden">{content}</div>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/generate/$generatedContentId/reel/edit")({
  component: ReelEditorRoute,
});
