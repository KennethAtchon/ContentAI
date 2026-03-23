import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";

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
      void invalidateContentAssetsForGeneration(
        queryClient,
        generatedContentId
      );
    },
  });
}
