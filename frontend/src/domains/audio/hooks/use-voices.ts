import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { useApp } from "@/app/state/app-context";
import { audioService } from "../api/audio.service";

export function useVoices() {
  const { user } = useApp();

  return useQuery({
    queryKey: queryKeys.api.audioVoices(),
    queryFn: () => audioService.getVoices(),
    enabled: !!user,
  });
}
