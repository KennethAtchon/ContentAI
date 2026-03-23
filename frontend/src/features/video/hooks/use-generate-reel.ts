import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { invalidateAfterGenerateReel } from "@/shared/lib/query-invalidation";
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
      void invalidateAfterGenerateReel(
        queryClient,
        variables.generatedContentId,
        res.jobId
      );
    },
  });
}
