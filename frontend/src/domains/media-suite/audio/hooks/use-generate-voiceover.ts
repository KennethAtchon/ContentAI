import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateContentAssetsForGeneration } from "@/app/query/query-invalidation";
import { audioService } from "../api/audio.service";
import type { GenerateVoiceoverRequest } from "../model/audio.types";

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
