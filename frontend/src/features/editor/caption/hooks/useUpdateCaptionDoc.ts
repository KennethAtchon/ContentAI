import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import type { Token } from "../types";

interface UpdateCaptionDocInput {
  captionDocId: string;
  tokens: Token[];
  fullText: string;
  language?: "en";
}

export function useUpdateCaptionDoc() {
  const queryClient = useQueryClient();
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: async (input: UpdateCaptionDocInput) =>
      authenticatedFetchJson<{ captionDocId: string; updatedAt: string }>(
        `/api/captions/doc/${input.captionDocId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            tokens: input.tokens,
            fullText: input.fullText,
            language: input.language ?? "en",
          }),
        },
      ),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.captionDoc(input.captionDocId),
      });
    },
  });
}
