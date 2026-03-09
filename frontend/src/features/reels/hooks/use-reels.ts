import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import type { Reel, ReelDetail, ReelAnalysis } from "../types/reel.types";

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export function useReels(niche: string) {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ reels: Reel[]; total: number; niche: string }>();

  return useQuery({
    queryKey: queryKeys.api.reels(niche),
    queryFn: () =>
      fetcher(`/api/reels?niche=${encodeURIComponent(niche)}&limit=20`),
    enabled: !!user && !!niche,
  });
}

export function useReel(id: number | null) {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ reel: ReelDetail; analysis: ReelAnalysis | null }>();

  return useQuery({
    queryKey: queryKeys.api.reel(id ?? 0),
    queryFn: () => fetcher(`/api/reels/${id}`),
    enabled: !!user && id !== null,
  });
}

export function useAnalyzeReel() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reelId: number) => {
      const res = await authenticatedFetch(`/api/reels/${reelId}/analyze`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Analysis failed");
      return res.json() as Promise<{ analysis: ReelAnalysis }>;
    },
    onSuccess: (_data, reelId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.api.reel(reelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.api.reelAnalysis(reelId) });
    },
  });
}
