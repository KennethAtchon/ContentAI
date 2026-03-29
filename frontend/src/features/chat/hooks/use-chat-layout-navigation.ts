import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";
import type { Project, ChatSession } from "../types/chat.types";

export function useChatLayoutNavigation(selectedProject: Project | undefined) {
  const navigate = useNavigate();

  const handleProjectSelect = useCallback(
    (project: Project) => {
      navigate({
        to: REDIRECT_PATHS.STUDIO_GENERATE,
        search: { projectId: project.id, sessionId: undefined, reelId: undefined },
      });
    },
    [navigate]
  );

  const handleSessionSelect = useCallback(
    (session: ChatSession) => {
      navigate({
        to: REDIRECT_PATHS.STUDIO_GENERATE,
        search: { projectId: session.projectId, sessionId: session.id, reelId: undefined },
      });
    },
    [navigate]
  );

  const handleSessionDeleted = useCallback(() => {
    navigate({
      to: REDIRECT_PATHS.STUDIO_GENERATE,
      search: selectedProject
        ? { projectId: selectedProject.id, sessionId: undefined, reelId: undefined }
        : { sessionId: undefined, projectId: undefined, reelId: undefined },
    });
  }, [navigate, selectedProject]);

  return {
    handleProjectSelect,
    handleSessionSelect,
    handleSessionDeleted,
  };
}
