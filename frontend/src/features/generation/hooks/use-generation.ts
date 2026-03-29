import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import {
  invalidateGenerationHistoryQueries,
  invalidateQueueAndGenerationHistory,
} from "@/shared/lib/query-invalidation";
import { useApp } from "@/shared/contexts/app-context";
import { generationService } from "../services/generation.service";

export function useGenerationHistory() {
  const { user } = useApp();

  return useQuery({
    queryKey: queryKeys.api.generationHistory(),
    queryFn: () => generationService.getHistory(),
    enabled: !!user,
  });
}

export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generationService.generateContent,
    onSuccess: () => {
      void invalidateGenerationHistoryQueries(queryClient);
    },
  });
}

export function useQueueContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generationService.queueContent,
    onSuccess: () => {
      void invalidateQueueAndGenerationHistory(queryClient);
    },
  });
}
