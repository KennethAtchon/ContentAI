import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateContentAssetsForGeneration } from "@/app/query/query-invalidation";
import { audioService } from "../api/audio.service";

export function useDeleteAsset(generatedContentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => audioService.deleteAsset(assetId),
    onSuccess: () => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        generatedContentId
      );
    },
    onError: () => {
      toast.error("Failed to delete asset");
    },
  });
}
