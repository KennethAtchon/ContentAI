import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";

export function useUpdateAssetMetadata(generatedContentId: number) {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assetId,
      metadata,
    }: {
      assetId: string;
      metadata: Record<string, unknown>;
    }) =>
      authenticatedFetchJson(`/api/assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify({ metadata }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.contentAssets(generatedContentId),
      });
    },
  });
}
