import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";

export function useDeleteAsset(generatedContentId: number) {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) =>
      authenticatedFetchJson(`/api/assets/${assetId}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        generatedContentId
      );
    },
  });
}
