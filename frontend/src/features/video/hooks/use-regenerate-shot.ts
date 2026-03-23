import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { invalidateAfterRegenerateShot } from "@/shared/lib/query-invalidation";
import type { CreateReelResponse } from "../types/video.types";

type RegenerateShotArgs = {
  generatedContentId: number;
  shotIndex: number;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
};

export function useRegenerateShot() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegenerateShotArgs) =>
      authenticatedFetchJson<CreateReelResponse>(
        "/api/video/shots/regenerate",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (res, variables) => {
      void invalidateAfterRegenerateShot(
        queryClient,
        variables.generatedContentId,
        res.jobId
      );
    },
  });
}
