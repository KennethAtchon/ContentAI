import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";
import { audioService } from "../services/audio.service";
import type { AttachMusicRequest } from "../types/audio.types";

export function useAttachMusic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AttachMusicRequest) => audioService.attachMusic(data),
    onSuccess: (_, variables) => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        variables.generatedContentId
      );
    },
  });
}
