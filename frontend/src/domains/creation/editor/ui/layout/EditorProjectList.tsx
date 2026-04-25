import { Plus, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EditProject } from "../../model/editor";

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

interface EditorProjectListProps {
  onOpen: (project: EditProject) => void;
}

export function EditorProjectList({ onOpen }: EditorProjectListProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full bg-studio-bg text-dim-1">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {t("editor_projects_title")}
            </h1>
            <p className="text-sm text-dim-3">Editor UI preview</p>
          </div>
          <button
            type="button"
            onClick={() => onOpen(previewProject)}
            className="flex items-center gap-1.5 rounded-md bg-studio-accent px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={15} />
            New
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpen(previewProject)}
          className="flex w-full items-center gap-4 rounded-lg border border-overlay-sm bg-studio-surface p-4 text-left hover:bg-overlay-sm"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-md bg-overlay-sm text-dim-2">
            <Video size={22} />
          </span>
          <span>
            <span className="block text-sm font-medium">
              {previewProject.title}
            </span>
            <span className="block text-xs text-dim-3">
              {previewProject.resolution} · {previewProject.fps} fps
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
