import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateEditorProjectsQueries } from "@/shared/lib/query-invalidation";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { patchEditorProject } from "../services/editor-api";
import { EDITOR_AUTOSAVE_DEBOUNCE_MS } from "../constants/editor";

import type { EditProject } from "../types/editor";

export function useEditorProject() {
  const queryClient = useQueryClient();
  const fetcher = useQueryFetcher<{ projects: EditProject[] }>();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the active project
  const { data } = useQuery({
    queryKey: queryKeys.api.editorProjects(),
    queryFn: () => fetcher("/api/editor"),
  });

  // Save mutation (debounced)
  const { mutate: save } = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof patchEditorProject>[1] }) =>
      patchEditorProject(id, patch),
    onSuccess: () => {
      void invalidateEditorProjectsQueries(queryClient);
    },
  });

  // Auto-save on tracks/title/duration change (debounced 2s)
  const scheduleSave = useCallback(
    (id: string, patch: object) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        save({ id, patch });
      }, EDITOR_AUTOSAVE_DEBOUNCE_MS);
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
