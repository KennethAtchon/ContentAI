import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { TextPreset } from "../types";

export function useCaptionPresets(): UseQueryResult<TextPreset[]> {
  const fetcher = useQueryFetcher<TextPreset[]>();

  return useQuery({
    queryKey: queryKeys.api.captionPresets(),
    queryFn: () => fetcher("/api/captions/presets"),
  });
}
