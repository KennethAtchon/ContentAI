import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type { ApiEnvelope, CompositionMode, CompositionRecord } from "../types/composition.types";

type InitCompositionArgs = {
  generatedContentId: number;
  mode?: CompositionMode;
};

export function useInitComposition() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      generatedContentId,
      mode = "quick",
    }: InitCompositionArgs): Promise<CompositionRecord> => {
      const res = await authenticatedFetchJson<ApiEnvelope<CompositionRecord>>(
        "/api/video/compositions/init",
        {
          method: "POST",
          body: JSON.stringify({ generatedContentId, mode }),
        },
      );

      if (!res.ok) {
        throw new Error(res.error.message);
      }

      return res.data;
    },
    onSuccess: (data) => {
      void queryClient.setQueryData(
        queryKeys.api.videoComposition(data.compositionId),
        data,
      );
    },
  });
}
