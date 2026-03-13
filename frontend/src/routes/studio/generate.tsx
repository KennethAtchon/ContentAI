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
      <div className="h-screen bg-studio-bg text-studio-fg font-studio flex flex-col overflow-hidden">
        <StudioTopBar variant="studio" activeTab="generate" />

        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-[36px] opacity-40">✦</span>
                <p className="text-[13px] font-semibold text-slate-200/40 mt-3">
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
                <span className="text-[36px] opacity-40">✦</span>
                <p className="text-[13px] font-semibold text-slate-200/40 mt-3">
                  {t("studio_projects_empty")}
                </p>
                <p className="text-[11px] text-slate-200/30 mt-1">
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
