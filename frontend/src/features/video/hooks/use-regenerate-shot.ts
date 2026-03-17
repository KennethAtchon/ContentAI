import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.contentAssets(variables.generatedContentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoJob(res.jobId),
      });
    },
  });
}
