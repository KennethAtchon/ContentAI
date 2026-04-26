import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { useAuth } from "@/app/state/auth-context";
import { audioService } from "../api/audio.service";

export function useVoices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.api.audioVoices(),
    queryFn: () => audioService.getVoices(),
    enabled: !!user,
  });
}
