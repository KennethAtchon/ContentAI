import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type { CreateReelResponse } from "../types/video.types";

type AssembleReelArgs = {
  generatedContentId: number;
  includeCaptions?: boolean;
  audioMix?: {
    includeClipAudio?: boolean;
    clipAudioVolume?: number;
    voiceoverVolume?: number;
    musicVolume?: number;
  };
};

export function useAssembleReel() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ generatedContentId, includeCaptions = true, audioMix }: AssembleReelArgs) =>
      authenticatedFetchJson<CreateReelResponse>("/api/video/assemble", {
        method: "POST",
        body: JSON.stringify({ generatedContentId, includeCaptions, audioMix }),
      }),
    onSuccess: (res, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.contentAssets(variables.generatedContentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.videoJob(res.jobId),
      });
    },
  });
}
