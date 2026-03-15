import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useApp } from "@/shared/contexts/app-context";
import type { Voice } from "../types/audio.types";

export function useVoices() {
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ voices: Voice[] }>();

  return useQuery({
    queryKey: queryKeys.api.audioVoices(),
    queryFn: () => fetcher("/api/audio/voices"),
    enabled: !!user,
  });
}
