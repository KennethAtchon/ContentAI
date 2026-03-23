import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { invalidateContentAssetsForGeneration } from "@/shared/lib/query-invalidation";
import type { AttachMusicRequest } from "../types/audio.types";

export function useAttachMusic() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AttachMusicRequest) =>
      authenticatedFetchJson("/api/music/attach", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      void invalidateContentAssetsForGeneration(
        queryClient,
        variables.generatedContentId
      );
    },
  });
}
