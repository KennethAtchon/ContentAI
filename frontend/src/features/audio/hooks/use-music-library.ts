import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { audioService } from "../services/audio.service";
import type { MusicLibraryFilters } from "../types/audio.types";

export function useMusicLibrary(filters: MusicLibraryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.api.musicLibrary(filters),
    queryFn: () => audioService.getMusicLibrary(filters),
  });
}
