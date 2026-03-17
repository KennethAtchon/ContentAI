import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { ApiEnvelope, CompositionRecord } from "../types/composition.types";

export function useComposition(compositionId: string | null) {
  const fetcher = useQueryFetcher<ApiEnvelope<CompositionRecord>>();

  return useQuery({
    queryKey: queryKeys.api.videoComposition(compositionId ?? ""),
    queryFn: async (): Promise<CompositionRecord> => {
      const res = await fetcher(`/api/video/compositions/${compositionId}`);
      if (!res.ok) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    enabled: !!compositionId,
  });
}
