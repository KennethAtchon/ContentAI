import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useApp } from "@/shared/contexts/app-context";
import type { Reel, ReelDetail } from "../types/reel.types";

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export function useReelNiches() {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ niches: { id: number; name: string }[] }>();

  return useQuery({
    queryKey: queryKeys.api.reelNiches(),
    queryFn: () => fetcher("/api/reels/niches"),
    enabled: !!user,
  });
}

export function useReels(params: {
  niche?: string;
  nicheId?: number | null;
  sort?: string;
  offset?: number;
}) {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{
    reels: Reel[];
    total: number;
    niche: string;
  }>();

  const { niche, nicheId, sort = "views", offset = 0 } = params;

  return useQuery({
    queryKey: queryKeys.api.reels(niche ?? String(nicheId ?? ""), {
      offset,
      sort,
      nicheId,
    }),
    queryFn: () => {
      const search = new URLSearchParams({
        limit: "20",
        offset: String(offset),
        sort,
      });
      if (nicheId != null) search.set("nicheId", String(nicheId));
      if (niche) search.set("niche", niche);
      return fetcher(`/api/reels?${search}`);
    },
    enabled: !!user && (!!niche || nicheId != null),
  });
}

export function useReel(id: number | null) {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ reel: ReelDetail }>();

  return useQuery({
    queryKey: queryKeys.api.reel(id ?? 0),
    queryFn: () => fetcher(`/api/reels/${id}`),
    enabled: !!user && id !== null,
  });
}

export function useReelMediaUrl(reelId: number | null, hasVideo: boolean) {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ url: string }>();

  return useQuery({
    queryKey: [...queryKeys.api.reel(reelId ?? 0), "media-url"],
    queryFn: () => fetcher(`/api/reels/${reelId}/media-url`),
    enabled: !!user && reelId !== null && hasVideo,
    staleTime: 30 * 60 * 1000, // 30 min — presigned URLs last 1h
  });
}

