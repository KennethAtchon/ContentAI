import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { audioService } from "../api/audio.service";
import type { MusicLibraryFilters } from "../model/audio.types";

export function useMusicLibrary(filters: MusicLibraryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.api.musicLibrary(filters),
    queryFn: () => audioService.getMusicLibrary(filters),
  });
}
