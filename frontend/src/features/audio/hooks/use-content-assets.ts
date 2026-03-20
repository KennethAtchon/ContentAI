import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { AssetsResponse } from "../types/audio.types";

export function useContentAssets(
  generatedContentId: number | null,
  type?: string,
  refetchInterval?: number | false
) {
  const fetcher = useQueryFetcher<AssetsResponse>();

  const params = new URLSearchParams();
  if (generatedContentId)
    params.set("generatedContentId", String(generatedContentId));
  if (type) params.set("type", type);

  return useQuery({
    queryKey: queryKeys.api.contentAssets(generatedContentId ?? 0, type),
    queryFn: () => fetcher(`/api/assets?${params.toString()}`),
    enabled: !!generatedContentId,
    refetchInterval,
  });
}
