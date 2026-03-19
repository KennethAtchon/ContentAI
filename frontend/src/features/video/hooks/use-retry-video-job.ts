import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoJob(res.jobId),
      });
    },
  });
}
