import { useEffect, useState } from "react";
import { Plus, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import { editorApi, type ProjectListItem } from "../../bridge";

interface EditorProjectListProps {
  onOpen: (projectId: string) => void;
}

export function EditorProjectList({ onOpen }: EditorProjectListProps) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  useEffect(() => {
    void editorApi.listProjects().then(setProjects).catch(() => {});
  }, []);

  return (
    <div className="h-full bg-studio-bg text-dim-1">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {t("editor_projects_title")}
            </h1>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-studio-accent px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={15} />
            New
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {projects.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex w-full items-center gap-4 rounded-lg border border-overlay-sm bg-studio-surface p-4 text-left hover:bg-overlay-sm"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-md bg-overlay-sm text-dim-2">
                <Video size={22} />
              </span>
              <span>
                <span className="block text-sm font-medium">
                  {item.title ?? "Untitled Edit"}
                </span>
                <span className="block text-xs text-dim-3">
                  {item.resolution} · {item.fps} fps
                </span>
              </span>
            </button>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-dim-3">No projects yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
