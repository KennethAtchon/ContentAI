import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateAdminMusicTracksQueries } from "@/shared/lib/query-invalidation";
import { adminMusicService } from "../services/admin-music.service";

export type { AdminMusicTrack } from "../types";

export function useAdminMusicTracks(search?: string) {
  return useQuery({
    queryKey: [...queryKeys.api.admin.musicRoot(), search],
    queryFn: () => adminMusicService.list(search),
  });
}

export function useUploadMusicTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => adminMusicService.upload(formData),
    onSuccess: () => {
      void invalidateAdminMusicTracksQueries(queryClient);
    },
  });
}

export function useToggleMusicTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminMusicService.toggleActive(id, isActive),
    onSuccess: () => {
      void invalidateAdminMusicTracksQueries(queryClient);
    },
  });
}

export function useDeleteMusicTrack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminMusicService.remove(id),
    onSuccess: () => {
      void invalidateAdminMusicTracksQueries(queryClient);
    },
  });
}
