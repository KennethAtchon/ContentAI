import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useApp } from "@/shared/contexts/app-context";
import { audioService } from "../services/audio.service";

export function useVoices() {
  const { user } = useApp();

  return useQuery({
    queryKey: queryKeys.api.audioVoices(),
    queryFn: () => audioService.getVoices(),
    enabled: !!user,
  });
}
