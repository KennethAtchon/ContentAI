import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import type { GeneratedContent } from "@/features/reels/types/reel.types";

export function useGenerationHistory() {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ items: GeneratedContent[]; total: number }>();

  return useQuery({
    queryKey: queryKeys.api.generationHistory(),
    queryFn: () => fetcher("/api/generation?limit=20"),
    enabled: !!user,
  });
}

export function useGenerateContent() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sourceReelId: number;
      prompt: string;
      outputType?: "hook" | "caption" | "full";
    }) => {
      const res = await authenticatedFetch("/api/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Generation failed");
      }
      return res.json() as Promise<{ content: GeneratedContent }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.generationHistory(),
      });
    },
  });
}

export function useQueueContent() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      contentId: number;
      scheduledFor?: string;
      instagramPageId?: string;
    }) => {
      const res = await authenticatedFetch(
        `/api/generation/${params.contentId}/queue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledFor: params.scheduledFor,
            instagramPageId: params.instagramPageId,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to queue content");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.api.queue() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.generationHistory(),
      });
    },
  });
}
