import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useApp } from "@/shared/contexts/app-context";
import { reelsService } from "../services/reels.service";

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export function useReelNiches() {
  const { user } = useApp();

  return useQuery({
    queryKey: queryKeys.api.reelNiches(),
    queryFn: () => reelsService.getNiches(),
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
  const { niche, nicheId, sort = "views", offset = 0 } = params;

  return useQuery({
    queryKey: queryKeys.api.reels(niche ?? String(nicheId ?? ""), {
      offset,
      sort,
      nicheId,
    }),
    queryFn: () => reelsService.getReels(params),
    enabled: !!user && (!!niche || nicheId != null),
  });
}

export function useReel(id: number | null) {
  const { user } = useApp();

  return useQuery({
    queryKey: queryKeys.api.reel(id ?? 0),
    queryFn: () => reelsService.getReel(id!),
    enabled: !!user && id !== null,
  });
}

export function useReelMediaUrl(reelId: number | null, hasVideo: boolean) {
  const { user } = useApp();

  return useQuery({
    queryKey: [...queryKeys.api.reel(reelId ?? 0), "media-url"],
    queryFn: () => reelsService.getMediaUrl(reelId!),
    enabled: !!user && reelId !== null && hasVideo,
    staleTime: 30 * 60 * 1000, // 30 min — presigned URLs last 1h
  });
}
