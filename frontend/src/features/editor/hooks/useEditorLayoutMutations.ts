import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { invalidateEditorProjectsQueries } from "@/shared/lib/query-invalidation";
import { publishEditorProject } from "../services/editor-api";
import type { EditProject } from "../types/editor";
import type { EditorStore } from "./useEditorStore";
import type { SaveService } from "../services/save-service";

type AuthenticatedFetchJson = <T>(
  url: string,
  init?: RequestInit
) => Promise<T>;

export function useEditorLayoutMutations(options: {
  project: EditProject;
  store: EditorStore;
  queryClient: QueryClient;
  authenticatedFetchJson: AuthenticatedFetchJson;
  onBack: () => void;
  saveService: SaveService;
}) {
  const { t } = useTranslation();
  const {
    project,
    store,
    queryClient,
    authenticatedFetchJson,
    onBack,
  } = options;

  const { mutateAsync: runPublish, isPending: isPublishing } = useMutation({
    mutationFn: () => publishEditorProject(project.id),
    onSuccess: (res) => {
      void invalidateEditorProjectsQueries(queryClient);
      store.loadProject({
        ...project,
        tracks: store.state.tracks,
        status: res.status as "published",
        publishedAt: res.publishedAt,
      });
    },
  });

  const { mutate: createNewDraft, isPending: isCreatingDraft } = useMutation({
    mutationFn: () =>
      authenticatedFetchJson<{ project: EditProject }>(
        `/api/editor/${project.id}/new-draft`,
        { method: "POST" }
      ),
    onSuccess: (res) => {
      void invalidateEditorProjectsQueries(queryClient);
      onBack();
      window.history.replaceState(
        window.history.state,
        "",
        `/studio/editor?projectId=${res.project.id}${res.project.generatedContentId ? `&contentId=${res.project.generatedContentId}` : ""}`
      );
    },
  });

  const { mutate: aiAssemble, isPending: isAiAssembling } = useMutation({
    mutationFn: (platform: string) =>
      authenticatedFetchJson<{
        timeline: EditProject["tracks"];
        fallback: boolean;
      }>(`/api/editor/${project.id}/ai-assemble`, {
        method: "POST",
        body: JSON.stringify({ platform }),
      }),
    onSuccess: (res) => {
      const merged: EditProject = { ...project, tracks: res.timeline };
      store.loadProject(merged);
      // Autosave detects the track change and schedules a save automatically
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : t("editor_ai_assemble_error");
      toast.error(msg);
    },
  });

  return {
    runPublish,
    isPublishing,
    createNewDraft,
    isCreatingDraft,
    aiAssemble,
    isAiAssembling,
  };
}
