import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCreateProject } from "@/features/chat/hooks/use-projects";
import { useCreateChatSession } from "@/features/chat/hooks/use-chat-sessions";
import { useAnalyzeReel } from "./use-reels";
import type { ReelDetail, ReelAnalysis } from "../types/reel.types";

export function useGenerateFromReel() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const createSession = useCreateChatSession();
  const analyzeReel = useAnalyzeReel();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateFromReel(
    reel: ReelDetail,
    analysis: ReelAnalysis | null,
  ) {
    setIsLoading(true);
    setError(null);

    try {
      // Run analysis if not already done
      if (!analysis) {
        await analyzeReel.mutateAsync(reel.id);
      }

      // Create a project named after the reel
      const projectName = `@${reel.username} Reel`;
      const project = await createProject.mutateAsync({ name: projectName });

      // Create a session inside that project
      const sessionTitle = reel.hook?.slice(0, 60) ?? "Reel Session";
      const session = await createSession.mutateAsync({
        projectId: project.id,
        title: sessionTitle,
      });

      // Navigate to Generate with the new project + session
      await navigate({
        to: "/studio/generate",
        search: { projectId: project.id, sessionId: session.id },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setIsLoading(false);
    }
  }

  return { generateFromReel, isLoading, error };
}
