import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { ChatLayout } from "@/features/chat/components/ChatLayout";
import { useProjects } from "@/features/chat/hooks/use-projects";

function GeneratePage() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useProjects();

  const handleNewProject = () => {
    // This could open a modal or navigate to a project creation page
    // TODO: Implement project creation modal or navigation
  };

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="generate" />

        <div className="h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-[36px] opacity-40">✦</span>
                <p className="text-[13px] font-semibold text-slate-200/40 mt-3">
                  Loading...
                </p>
              </div>
            </div>
          ) : projects ? (
            <ChatLayout projects={projects} onNewProject={handleNewProject} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-[36px] opacity-40">✦</span>
                <p className="text-[13px] font-semibold text-slate-200/40 mt-3">
                  {t("studio_projects_empty")}
                </p>
                <p className="text-[11px] text-slate-200/30 mt-1">
                  Create your first project to start chatting
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
