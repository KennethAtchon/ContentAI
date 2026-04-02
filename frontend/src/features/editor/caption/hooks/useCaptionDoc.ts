import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { CaptionDoc } from "../types";

export function useCaptionDoc(
  captionDocId: string | null,
): UseQueryResult<CaptionDoc | null> {
  const fetcher = useQueryFetcher<CaptionDoc>();

  return useQuery({
    queryKey: captionDocId
      ? queryKeys.api.captionDoc(captionDocId)
      : ["api", "captions", "doc", null],
    queryFn: async () => {
      if (!captionDocId) return null;
      return fetcher(`/api/captions/doc/${captionDocId}`);
    },
    enabled: !!captionDocId,
  });
}
