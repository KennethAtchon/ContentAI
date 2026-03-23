import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateAdminMusicTracksQueries } from "@/shared/lib/query-invalidation";

export interface AdminMusicTrack {
  id: string;
  name: string;
  artistName: string | null;
  durationSeconds: number;
  mood: string;
  genre: string | null;
  r2Key: string;
  isActive: boolean;
  uploadedBy: string | null;
  createdAt: string;
}

export function useAdminMusicTracks(search?: string) {
  const fetcher = useQueryFetcher<{ tracks: AdminMusicTrack[] }>();
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: [...queryKeys.api.admin.musicRoot(), search],
    queryFn: () => fetcher(`/api/admin/music${params}`),
  });
}

export function useUploadMusicTrack() {
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await authenticatedFetch("/api/admin/music", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Upload failed");
      }
      return res.json() as Promise<{ track: AdminMusicTrack }>;
    },
    onSuccess: () => {
      void invalidateAdminMusicTracksQueries(queryClient);
    },
  });
}

export function useToggleMusicTrack() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      authenticatedFetchJson<{ track: AdminMusicTrack }>(
        `/api/admin/music/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive }),
        }
      ),
    onSuccess: () => {
      void invalidateAdminMusicTracksQueries(queryClient);
    },
  });
}

export function useDeleteMusicTrack() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      authenticatedFetchJson(`/api/admin/music/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidateAdminMusicTracksQueries(queryClient);
    },
  });
}
