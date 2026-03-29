import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";
import { audioService } from "../services/audio.service";

export function useDeleteAsset(generatedContentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => audioService.deleteAsset(assetId),
    onSuccess: () => {
      void invalidateContentAssetsForGeneration(queryClient, generatedContentId);
    },
  });
}
