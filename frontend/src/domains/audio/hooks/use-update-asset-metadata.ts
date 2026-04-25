import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateContentAssetsForGeneration } from "@/app/query/query-invalidation";
import { audioService } from "../api/audio.service";

export function useUpdateAssetMetadata(generatedContentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assetId,
      metadata,
    }: {
      assetId: string;
      metadata: Record<string, unknown>;
    }) => audioService.updateAssetMetadata(assetId, metadata),
    onSuccess: () => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        generatedContentId
      );
    },
    onError: () => {
      toast.error("Failed to update audio settings");
    },
  });
}
