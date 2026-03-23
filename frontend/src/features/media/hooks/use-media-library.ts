import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateMediaLibraryQueries } from "@/shared/lib/query-invalidation";
import { mediaService } from "../services/media.service";
import type { MediaLibraryResponse } from "../types/media.types";

export function useMediaLibrary() {
  const fetcher = useQueryFetcher<MediaLibraryResponse>();

  return useQuery({
    queryKey: queryKeys.api.mediaLibrary(),
    queryFn: () => fetcher("/api/media"),
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, name }: { file: File; name?: string }) =>
      mediaService.upload(file, name),
    onSuccess: () => {
      void invalidateMediaLibraryQueries(queryClient);
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mediaService.delete(id),
    onSuccess: () => {
      void invalidateMediaLibraryQueries(queryClient);
    },
  });
}
