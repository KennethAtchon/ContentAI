import { useState } from "react";
import type { EditProject } from "@/features/editor/types/editor";
import { EditorLayout } from "./EditorLayout";
import { EditorProjectList } from "./EditorProjectList";

export interface EditorRouteSearch {
  projectId?: string;
  contentId?: number;
}

const previewProject: EditProject = {
  id: "00000000-0000-4000-8000-000000000000",
  userId: "preview",
  title: "Untitled Edit",
  generatedContentId: null,
  tracks: [],
  durationMs: 12_000,
  fps: 30,
  resolution: "1080x1920",
  createdAt: "",
  updatedAt: "",
  status: "draft",
  publishedAt: null,
  parentProjectId: null,
};

export function EditorRoutePage({ search }: { search: EditorRouteSearch }) {
  const [activeProject, setActiveProject] = useState<EditProject | null>(
    search.projectId || search.contentId ? previewProject : null
  );

  if (activeProject) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex flex-col overflow-hidden">
        <EditorLayout project={activeProject} onBack={() => setActiveProject(null)} />
      </div>
    );
  }

  return <EditorProjectList onOpen={setActiveProject} />;
}
