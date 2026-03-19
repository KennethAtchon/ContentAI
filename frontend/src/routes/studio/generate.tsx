import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { ChatLayout } from "@/features/chat/components/ChatLayout";
import { useProjects } from "@/features/chat/hooks/use-projects";
import { useState } from "react";

function GeneratePage() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useProjects();
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);

  const handleNewProject = () => {
    setShowNewProjectForm(true);
  };

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="generate" />

        <div className="min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-5xl opacity-40">✦</span>
                <p className="text-base font-semibold text-dim-2 mt-3">
                  {t("studio_loading")}
                </p>
              </div>
            </div>
          ) : projects ? (
            <ChatLayout
              projects={projects}
              onNewProject={handleNewProject}
              showNewProjectForm={showNewProjectForm}
              onHideNewProjectForm={() => setShowNewProjectForm(false)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-5xl opacity-40">✦</span>
                <p className="text-base font-semibold text-dim-2 mt-3">
                  {t("studio_projects_empty")}
                </p>
                <p className="text-sm text-dim-3 mt-1">
                  {t("studio_projects_emptyDescription")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/generate")({
  component: GeneratePage,
});
