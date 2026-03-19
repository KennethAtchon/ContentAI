import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type {
  CreateReelRequest,
  CreateReelResponse,
} from "../types/video.types";

export function useGenerateReel() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReelRequest) =>
      authenticatedFetchJson<CreateReelResponse>("/api/video/reel", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (res, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.generatedContent(variables.generatedContentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.contentAssets(variables.generatedContentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoJob(res.jobId),
      });
    },
  });
}
