import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCreateProject } from "@/features/chat/hooks/use-projects";
import { useCreateChatSession } from "@/features/chat/hooks/use-chat-sessions";
import type { ReelDetail } from "../types/reel.types";

export function useGenerateFromReel() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const createSession = useCreateChatSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateFromReel(reel: ReelDetail) {
    setIsLoading(true);
    setError(null);

    try {
      const projectName = `@${reel.username} Reel`;
      const project = await createProject.mutateAsync({ name: projectName });

      const sessionTitle = reel.hook?.slice(0, 60) ?? "Reel Session";
      const session = await createSession.mutateAsync({
        projectId: project.id,
        title: sessionTitle,
      });

      await navigate({
        to: "/studio/generate",
        search: { projectId: project.id, sessionId: session.id },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setIsLoading(false);
    }
  }

  return { generateFromReel, isLoading, error };
}
