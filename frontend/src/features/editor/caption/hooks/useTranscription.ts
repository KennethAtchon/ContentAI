import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { invalidateCaptionQueriesAfterTranscription } from "@/shared/lib/query-invalidation";
import type { Token } from "../types";

interface TranscriptionResponse {
  captionDocId: string;
  tokens: Token[];
  fullText: string;
}

interface TranscriptionInput {
  assetId: string;
  force?: boolean;
}

export function useTranscription() {
  const queryClient = useQueryClient();
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: async (input: TranscriptionInput) =>
      authenticatedFetchJson<TranscriptionResponse>(
        "/api/captions/transcribe",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: (result, input) => {
      void invalidateCaptionQueriesAfterTranscription(
        queryClient,
        input.assetId,
        result.captionDocId
      );
    },
  });
}
