import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";

export function useDeleteAsset(generatedContentId: number) {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) =>
      authenticatedFetchJson(`/api/assets/${assetId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.contentAssets(generatedContentId),
      });
    },
  });
}
