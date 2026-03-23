import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { invalidateVideoJob } from "@/shared/lib/query-invalidation";
import type { CreateReelResponse } from "../types/video.types";

export function useRetryVideoJob() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) =>
      authenticatedFetchJson<CreateReelResponse>(
        `/api/video/jobs/${jobId}/retry`,
        {
          method: "POST",
        }
      ),
    onSuccess: (res) => {
      void invalidateVideoJob(queryClient, res.jobId);
    },
  });
}
