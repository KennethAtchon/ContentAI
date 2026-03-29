import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";
import { audioService } from "../services/audio.service";

export function useUpdateAssetMetadata(generatedContentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, metadata }: { assetId: string; metadata: Record<string, unknown> }) =>
      audioService.updateAssetMetadata(assetId, metadata),
    onSuccess: () => {
      void invalidateContentAssetsForGeneration(queryClient, generatedContentId);
    },
  });
}
