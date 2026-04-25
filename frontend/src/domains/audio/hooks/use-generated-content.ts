import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { audioService } from "../api/audio.service";

export function useGeneratedContent(id: number | null) {
  return useQuery({
    queryKey: queryKeys.api.generatedContent(id ?? 0),
    queryFn: () => audioService.getGeneratedContent(id!),
    enabled: !!id,
  });
}
