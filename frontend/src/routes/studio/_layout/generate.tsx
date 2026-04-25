import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChatLayout } from "@/domains/chat/ui/ChatLayout";
import { useProjects } from "@/domains/chat/hooks/use-projects";
import { useState } from "react";

function GeneratePage() {
  const { t } = useTranslation();
  const { data: projects, isPending, isError, refetch } = useProjects();
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);

  return (
    <div className="h-full overflow-hidden">
      {isPending && projects === undefined ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <span className="text-5xl opacity-40">✦</span>
            <p className="text-base font-semibold text-dim-2 mt-3">
              {t("studio_loading")}
            </p>
          </div>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <p className="text-base font-semibold text-dim-2">
              Failed to load your projects
            </p>
            <button
              onClick={() => void refetch()}
              className="px-4 py-2 rounded-lg border border-overlay-md text-sm text-dim-1 hover:bg-overlay-xs transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : projects !== undefined ? (
        <ChatLayout
          projects={projects}
          onNewProject={() => setShowNewProjectForm(true)}
          showNewProjectForm={showNewProjectForm}
          onHideNewProjectForm={() => setShowNewProjectForm(false)}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <span className="text-5xl opacity-40">✦</span>
            <p className="text-base font-semibold text-dim-2 mt-3">
              {t("studio_loading")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/studio/_layout/generate")({
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId:
      typeof search.sessionId === "string" ? search.sessionId : undefined,
    projectId:
      typeof search.projectId === "string" ? search.projectId : undefined,
    reelId: typeof search.reelId === "string" ? search.reelId : undefined,
  }),
  component: GeneratePage,
});
