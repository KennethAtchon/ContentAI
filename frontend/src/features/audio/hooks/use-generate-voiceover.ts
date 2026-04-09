import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";
import { audioService } from "../services/audio.service";
import type { GenerateVoiceoverRequest } from "../types/audio.types";

export function useGenerateVoiceover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerateVoiceoverRequest) =>
      audioService.generateVoiceover(data),
    onSuccess: (_, variables) => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        variables.generatedContentId
      );
    },
  });
}
