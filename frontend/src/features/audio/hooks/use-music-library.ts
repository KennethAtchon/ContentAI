import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { MusicLibraryFilters, MusicLibraryResponse } from "../types/audio.types";

export function useMusicLibrary(filters: MusicLibraryFilters = {}) {
  const fetcher = useQueryFetcher<MusicLibraryResponse>();

  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.mood) params.set("mood", filters.mood);
  if (filters.durationBucket) params.set("durationBucket", filters.durationBucket);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const query = params.toString();

  return useQuery({
    queryKey: queryKeys.api.musicLibrary(filters),
    queryFn: () => fetcher(`/api/music/library${query ? `?${query}` : ""}`),
  });
}
