import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type { ApiEnvelope } from "../types/composition.types";

type TriggerRenderArgs = {
  compositionId: string;
  expectedVersion: number;
  outputPreset?: string;
  includeCaptions?: boolean;
};

type TriggerRenderResponse = {
  jobId: string;
  status: "queued" | "rendering";
  compositionId: string;
  compositionVersion: number;
};

export function useTriggerRender() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      compositionId,
      expectedVersion,
      outputPreset = "instagram-9-16",
      includeCaptions = true,
    }: TriggerRenderArgs): Promise<TriggerRenderResponse> => {
      const res = await authenticatedFetchJson<ApiEnvelope<TriggerRenderResponse>>(
        `/api/video/compositions/${compositionId}/render`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion,
            outputPreset,
            includeCaptions,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoComposition(data.compositionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoCompositionJob(data.jobId),
      });
    },
  });
}
