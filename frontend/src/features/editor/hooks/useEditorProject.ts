import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";

import type { EditProject } from "../types/editor";

export function useEditorProject() {
  const queryClient = useQueryClient();
  const fetcher = useQueryFetcher<{ projects: EditProject[] }>();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the active project
  const { data } = useQuery({
    queryKey: queryKeys.api.editorProjects(),
    queryFn: () => fetcher("/api/editor"),
  });

  // Save mutation (debounced)
  const { mutate: save } = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: object }) =>
      authenticatedFetchJson(`/api/editor/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.editorProjects(),
      });
    },
  });

  // Auto-save on tracks/title/duration change (debounced 2s)
  const scheduleSave = useCallback(
    (id: string, patch: object) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        save({ id, patch });
      }, 2000);
    },
    [save]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { projects: data?.projects ?? [], scheduleSave };
}
