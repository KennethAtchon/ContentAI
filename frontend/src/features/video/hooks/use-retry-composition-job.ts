import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type { ApiEnvelope } from "../types/composition.types";

type RetryCompositionJobResponse = {
  jobId: string;
  status: "queued" | "rendering";
};

export function useRetryCompositionJob() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      jobId: string,
    ): Promise<RetryCompositionJobResponse> => {
      const res =
        await authenticatedFetchJson<ApiEnvelope<RetryCompositionJobResponse>>(
          `/api/video/composition-jobs/${jobId}/retry`,
          {
            method: "POST",
          },
        );
      if (!res.ok) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoCompositionJob(data.jobId),
      });
    },
  });
}
