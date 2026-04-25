import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { invalidateAfterGenerateReel } from "@/app/query/query-invalidation";
import type {
  CreateReelRequest,
  CreateReelResponse,
} from "../model/video.types";

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
      toast.success("Reel queued for generation");
    },
    onError: () => {
      toast.error("Failed to queue reel generation");
    },
  });
}
