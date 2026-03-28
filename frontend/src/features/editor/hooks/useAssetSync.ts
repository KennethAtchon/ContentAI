import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateEditorProjectsQueries } from "@/shared/lib/query-invalidation";
import { syncEditorProjectAssets } from "../services/editor-api";
import type { EditProject, Track } from "../types/editor";

export function useAssetSync(
  project: EditProject,
  onSynced: (tracks: Track[], durationMs: number) => void,
) {
  const queryClient = useQueryClient();

  const { mutate: syncAssets, isPending: isSyncing } = useMutation({
    mutationFn: () => syncEditorProjectAssets(project.id),
    onSuccess: (res) => {
      if (res.changed) {
        void invalidateEditorProjectsQueries(queryClient);
        onSynced(res.tracks, res.durationMs);
      }
    },
  });

  return { syncAssets, isSyncing };
}
