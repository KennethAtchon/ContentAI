import { useEffect, useState } from "react";
import type { EditProject } from "../../model/editor";
import { EditorLayout } from "./EditorLayout";
import { EditorProjectList } from "./EditorProjectList";
import { getEditorBridge, disposeEditorBridge } from "../../bridge";

export interface EditorRouteSearch {
  projectId?: string;
  contentId?: number;
}

export function EditorRoutePage({ search }: { search: EditorRouteSearch }) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(
    search.projectId ?? null,
  );
  const [activeProject, setActiveProject] = useState<EditProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!openProjectId) {
      setActiveProject(null);
      return;
    }

    setLoadError(null);

    const bridge = getEditorBridge();
    bridge.initialize(openProjectId, {
      onProjectLoaded: setActiveProject,
      onSaveRevisionUpdated: (saveRevision) => {
        setActiveProject((prev) => (prev ? { ...prev, saveRevision } : prev));
      },
      onSaveConflict: () => {
        // TODO: surface conflict dialog when reducer/store wired
      },
      onLoadError: (err) => {
        setLoadError(err.message);
      },
    });

    return () => {
      disposeEditorBridge();
    };
  }, [openProjectId]);

  if (openProjectId && !activeProject && !loadError) {
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

  if (activeProject) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex flex-col overflow-hidden">
        <EditorLayout
          project={activeProject}
          onBack={() => {
            disposeEditorBridge();
            setOpenProjectId(null);
            setActiveProject(null);
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
