import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { CaptionWord } from "../types/editor";

interface CaptionResponse {
  captionId: string;
  words: CaptionWord[];
  fullText: string;
}

export function useAutoCaption() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  return useMutation({
    mutationFn: async (assetId: string): Promise<CaptionResponse> => {
      return authenticatedFetchJson<CaptionResponse>(
        "/api/captions/transcribe",
        {
          method: "POST",
          body: JSON.stringify({ assetId }),
        },
      );
    },
  });
}

export function useCaptionsByAsset(assetId: string | undefined) {
  const fetcher = useQueryFetcher<CaptionResponse>();

  return useQuery({
    queryKey: queryKeys.api.captionsByAsset(assetId ?? ""),
    queryFn: () => fetcher(`/api/captions/${assetId}`),
    enabled: !!assetId,
  });
}
