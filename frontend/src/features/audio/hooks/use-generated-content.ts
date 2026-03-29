import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { audioService } from "../services/audio.service";

export function useGeneratedContent(id: number | null) {
  return useQuery({
    queryKey: queryKeys.api.generatedContent(id ?? 0),
    queryFn: () => audioService.getGeneratedContent(id!),
    enabled: !!id,
  });
}
