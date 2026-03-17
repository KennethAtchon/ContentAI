import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type {
  ApiEnvelope,
  CompositionVersionItem,
} from "../types/composition.types";

type CompositionVersionsResponse = {
  items: CompositionVersionItem[];
};

export function useCompositionVersions(compositionId: string | null) {
  const fetcher = useQueryFetcher<ApiEnvelope<CompositionVersionsResponse>>();

  return useQuery({
    queryKey: queryKeys.api.videoCompositionVersions(compositionId ?? ""),
    queryFn: async (): Promise<CompositionVersionsResponse> => {
      const res = await fetcher(`/api/video/compositions/${compositionId}/versions`);
      if (!res.ok) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    enabled: !!compositionId,
  });
}
