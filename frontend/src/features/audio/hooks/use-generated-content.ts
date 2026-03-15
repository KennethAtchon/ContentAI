import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";

interface GeneratedContentRecord {
  id: number;
  generatedScript: string | null;
  generatedHook: string | null;
  generatedCaption: string | null;
  outputType: string;
  status: string;
}

export function useGeneratedContent(id: number | null) {
  const fetcher = useQueryFetcher<{ content: GeneratedContentRecord }>();

  return useQuery({
    queryKey: queryKeys.api.generatedContent(id ?? 0),
    queryFn: () => fetcher(`/api/generation/${id}`),
    enabled: !!id,
  });
}
