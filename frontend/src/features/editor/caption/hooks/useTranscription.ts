import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type { Token } from "../types";

interface TranscriptionResponse {
  captionDocId: string;
  tokens: Token[];
  fullText: string;
}

export function useTranscription() {
  const queryClient = useQueryClient();
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: async (assetId: string) =>
      authenticatedFetchJson<TranscriptionResponse>("/api/captions/transcribe", {
        method: "POST",
        body: JSON.stringify({ assetId }),
      }),
    onSuccess: (result, assetId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.captionDocByAsset(assetId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.captionDoc(result.captionDocId),
      });
    },
  });
}
