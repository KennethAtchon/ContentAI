import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { EditorShell } from "@/features/video/components/editor/EditorShell";
import { useAutosaveComposition } from "@/features/video/hooks/use-autosave-composition";
import { useComposition } from "@/features/video/hooks/use-composition";
import { useEditorHistory } from "@/features/video/hooks/use-editor-history";
import { useInitComposition } from "@/features/video/hooks/use-init-composition";
import type {
  CompositionRecord,
  EditorSelection,
  Timeline,
} from "@/features/video/types/composition.types";
import {
  normalizeTimeline,
  splitVideoItemAt,
} from "@/features/video/utils/timeline-utils";

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
  const history = useEditorHistory();

  const runInit = useCallback(
    () =>
      initComposition
        .mutateAsync({ generatedContentId, mode: "quick" })
        .then((data) => {
          setCompositionId(data.compositionId);
          // Render from init payload immediately; do not block on follow-up GET.
          setEditableComposition(data);
          setSelection({
            videoClipId: data.timeline.tracks.video[0]?.id ?? null,
            textOverlayId: null,
          });
          history.resetHistory();
        }),
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
    history.resetHistory();
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
        videoClipId: hasVideoSelection
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

  const isLoading = Boolean(
    isValidDraftId &&
      !editableComposition &&
      (initComposition.isPending ||
        (!initComposition.error && !compositionId) ||
        (Boolean(compositionId) && compositionQuery.isFetching)),
  );
  const errorMessage = useMemo(() => {
    if (!isValidDraftId) return t("phase5_editor_invalid_draft");
    return (
      initComposition.error?.message ?? compositionQuery.error?.message ?? null
    );
  }, [
    compositionQuery.error?.message,
    initComposition.error?.message,
    isValidDraftId,
    t,
  ]);

  let content: React.ReactNode = null;
  const handleTimelineChange = useCallback(
    (nextTimeline: Timeline) => {
      history.applyTimelineAction(
        selection,
        setEditableComposition,
        setSelection,
        t("phase5_editor_action_timeline_edit"),
        { source: "ui", category: "timeline" },
        () => ({
          timeline: nextTimeline,
        }),
      );
    },
    [history, selection, t],
  );

  const handleUndo = useCallback(() => {
    history.undo(
      selection,
      t("phase5_editor_action_timeline_edit"),
      { source: "keyboard", category: "history" },
      (label) => t("phase5_editor_action_undo_named", { label }),
      setEditableComposition,
      setSelection,
    );
  }, [history, selection, t]);

  const handleRedo = useCallback(() => {
    history.redo(
      selection,
      t("phase5_editor_action_timeline_edit"),
      { source: "keyboard", category: "history" },
      (label) => t("phase5_editor_action_redo_named", { label }),
      setEditableComposition,
      setSelection,
    );
  }, [history, selection, t]);

  const handleDeleteShortcut = useCallback(() => {
    history.applyTimelineAction(
      selection,
      setEditableComposition,
      setSelection,
      t("phase5_editor_action_delete"),
      { source: "keyboard", category: "other" },
      (prev) => {
        if (selection.textOverlayId) {
          return {
            timeline: {
              ...prev.timeline,
              tracks: {
                ...prev.timeline.tracks,
                text: prev.timeline.tracks.text.filter(
                  (item) =>
                    String((item as Record<string, unknown>).id ?? "") !==
                    selection.textOverlayId,
                ),
              },
            },
            selection: { textOverlayId: null },
          };
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
          return {
            timeline: nextTimeline,
            selection: { videoClipId: nextTimeline.tracks.video[0]?.id ?? null },
          };
        }
        return null;
      },
    );
  }, [history, selection, t]);

  const handleSplitShortcut = useCallback(() => {
    history.applyTimelineAction(
      selection,
      setEditableComposition,
      setSelection,
      t("phase5_editor_action_split"),
      { source: "keyboard", category: "timeline" },
      (prev) => {
        if (!selection.videoClipId) return null;
        const nextTimeline = splitVideoItemAt(prev.timeline, selection.videoClipId);
        if (nextTimeline === prev.timeline) return null;
        const nextSelected =
          nextTimeline.tracks.video.find((item) =>
            item.id.startsWith(`${selection.videoClipId}-a-`),
          )?.id ??
          nextTimeline.tracks.video[0]?.id ??
          null;
        return {
          timeline: nextTimeline,
          selection: { videoClipId: nextSelected },
        };
      },
    );
  }, [history, selection, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as
        | { tagName?: string; isContentEditable?: boolean }
        | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tag === "input" || tag === "textarea" || target?.isContentEditable === true;
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
        <p className="text-xs text-muted-foreground">{t("phase5_editor_loading")}</p>
      </div>
    );
  } else if (errorMessage) {
    content = (
      <div className="flex h-full items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-center">
          <p className="text-sm text-red-300">{errorMessage}</p>
          <p className="mt-2 text-xs text-red-200/80">
            {t("phase5_editor_guardrail_missing_composition")}
          </p>
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
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        lastActionLabel={history.lastActionLabel}
        nextUndoLabel={history.nextUndoLabel}
        nextRedoLabel={history.nextRedoLabel}
        historyTrail={history.historyTrail}
        editMode={editableComposition.editMode ?? "quick"}
        onEditModeChange={(mode) =>
          setEditableComposition((prev) =>
            prev
              ? {
                  ...prev,
                  editMode: mode,
                }
              : prev,
          )
        }
      />
    );
  }

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="editor" />
        <div className="min-h-0 overflow-hidden">{content}</div>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/editor/$generatedContentId")({
  component: ReelEditorRoute,
});
