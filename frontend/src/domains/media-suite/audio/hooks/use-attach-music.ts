import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateContentAssetsForGeneration } from "@/app/query/query-invalidation";
import { audioService } from "../api/audio.service";
import type { AttachMusicRequest } from "../model/audio.types";

export function useAttachMusic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AttachMusicRequest) => audioService.attachMusic(data),
    onSuccess: (_, variables) => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        variables.generatedContentId
      );
      toast.success("Music attached");
    },
    onError: () => {
      toast.error("Failed to attach music");
    },
  });
}
