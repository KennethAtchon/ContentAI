import { useEffect, useState } from "react";
import { shallow } from "zustand/shallow";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorTimelineStore } from "../../store/editor-timeline-store";
import { useEditorUIStore } from "../../store/editor-ui-store";
import { EditorLayout } from "./EditorLayout";
import { EditorProjectList } from "./EditorProjectList";
import { getEditorBridge, disposeEditorBridge } from "../../bridge";
import { getEditorRuntime, disposeEditorRuntime } from "../../runtime/editor-runtime";

export interface EditorRouteSearch {
  projectId?: string;
  contentId?: number;
}

export function EditorRoutePage({ search }: { search: EditorRouteSearch }) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(
    search.projectId ?? null,
  );
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProjectStore: (() => void) | null = null;

    if (!openProjectId) {
      setIsReady(false);
      return;
    }

    setIsReady(false);
    setLoadError(null);

    const bridge = getEditorBridge();
    bridge.initialize(openProjectId, {
      onProjectLoaded: (project) => {
        useEditorProjectStore.getState().loadProject(project);
        useEditorTimelineStore.getState().reset();
        useEditorUIStore.getState().reset();
        getEditorRuntime().loadProject(project);

        unsubscribeProjectStore?.();
        unsubscribeProjectStore = useEditorProjectStore.subscribe(
          (state) => [
            state.tracks,
            state.title,
            state.durationMs,
            state.fps,
            state.resolution,
          ] as const,
          () => {
            const state = useEditorProjectStore.getState();
            getEditorRuntime().syncFromEditorState(state);
            bridge.notifyStateChanged({
              tracks: state.tracks,
              durationMs: state.durationMs,
              title: state.title,
              fps: state.fps,
              resolution: state.resolution,
              saveRevision: state.saveRevision,
              createdAt: state.createdAt,
            });
          },
          { equalityFn: shallow },
        );

        setIsReady(true);
      },
      onSaveRevisionUpdated: (saveRevision) => {
        useEditorProjectStore.getState().updateSaveRevision(saveRevision);
      },
      onSaveConflict: () => {
        useEditorProjectStore.getState().setReadOnly();
      },
      onLoadError: (err) => {
        setLoadError(err.message);
      },
    });

    return () => {
      unsubscribeProjectStore?.();
      disposeEditorBridge();
      disposeEditorRuntime();
      useEditorProjectStore.getState().reset();
      useEditorTimelineStore.getState().reset();
      useEditorUIStore.getState().reset();
      setIsReady(false);
    };
  }, [openProjectId]);

  if (openProjectId && !isReady && !loadError) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex items-center justify-center text-dim-3 text-sm">
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex items-center justify-center text-red-400 text-sm">
        {loadError}
      </div>
    );
  }

  if (isReady) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex flex-col overflow-hidden">
        <EditorLayout
          onBack={() => {
            disposeEditorBridge();
            disposeEditorRuntime();
            useEditorProjectStore.getState().reset();
            useEditorTimelineStore.getState().reset();
            useEditorUIStore.getState().reset();
            setOpenProjectId(null);
            setIsReady(false);
          }}
        />
      </div>
    );
  }

  return (
    <EditorProjectList
      onOpen={(id) => {
        setOpenProjectId(id);
      }}
    />
  );
}
