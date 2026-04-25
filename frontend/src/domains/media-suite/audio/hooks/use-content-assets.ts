import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { audioService } from "../api/audio.service";

export function useContentAssets(
  generatedContentId: number | null,
  type?: string,
  refetchInterval?: number | false
) {
  return useQuery({
    queryKey: queryKeys.api.contentAssets(generatedContentId ?? 0, type),
    queryFn: () => audioService.getContentAssets(generatedContentId!, type),
    enabled: !!generatedContentId,
    refetchInterval,
  });
}
