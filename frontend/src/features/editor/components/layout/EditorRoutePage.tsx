import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";
import type { EditProject } from "@/features/editor/types/editor";
import { useResolvedParam } from "@/shared/hooks/use-resolved-param";
import { EditorLayout } from "./EditorLayout";
import { EditorProjectList } from "./EditorProjectList";

export interface EditorRouteSearch {
  projectId?: string;
  contentId?: number;
}

export function EditorRoutePage({ search }: { search: EditorRouteSearch }) {
  const { t } = useTranslation();
  const { user } = useApp();
  const { contentId, projectId: projectIdFromUrl } = search;
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const navigate = useNavigate();
  const [activeProject, setActiveProject] = useState<EditProject | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isProjectMissing, setIsProjectMissing] = useState(false);
  const [isSmallScreen] = useState(() => window.innerWidth < 1280);
  const fetchAndOpenRef = useRef<AbortController | null>(null);

  const syncEditorUrl = useCallback(
    (project: EditProject) => {
      void navigate({
        to: REDIRECT_PATHS.STUDIO_EDITOR,
        search: {
          projectId: project.id,
          contentId: project.generatedContentId ?? undefined,
        },
        replace: true,
      });
    },
    [navigate]
  );

  const fetchAndOpen = useCallback(
    async (id: string) => {
      if (fetchAndOpenRef.current) fetchAndOpenRef.current.abort();
      const controller = new AbortController();
      fetchAndOpenRef.current = controller;
      setIsLoadingProject(true);
      try {
        const res = await authenticatedFetchJson<{ project: EditProject }>(`/api/editor/${id}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setIsProjectMissing(false);
        setActiveProject(res.project);
        syncEditorUrl(res.project);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          setIsProjectMissing(true);
        } else if (!controller.signal.aborted) {
          toast.error("Failed to open project.");
        }
      } finally {
        if (fetchAndOpenRef.current === controller) {
          fetchAndOpenRef.current = null;
          setIsLoadingProject(false);
        }
      }
    },
    [authenticatedFetchJson, syncEditorUrl]
  );

  const { mutate: createFromContent, isPending: isOpeningContent } = useMutation({
    mutationFn: (cId: number) =>
      authenticatedFetchJson<{ project: EditProject }>("/api/editor", {
        method: "POST",
        body: JSON.stringify({ generatedContentId: cId }),
      }),
    onSuccess: (res) => {
      setIsProjectMissing(false);
      setActiveProject(res.project);
      syncEditorUrl(res.project);
    },
    onError: async (err) => {
      const status = (err as { status?: number }).status;
      const body = (err as { body?: { existingProjectId?: string } }).body;
      if (status === 409 && body?.existingProjectId) {
        void fetchAndOpen(body.existingProjectId);
      }
    },
  });

  useResolvedParam({
    paramValue: projectIdFromUrl,
    isLoading: isLoadingProject,
    isMissing:
      Boolean(projectIdFromUrl) &&
      !activeProject &&
      isProjectMissing,
    notFoundMessage: "Project not found",
    onMissing: () => {
      setActiveProject(null);
      setIsProjectMissing(false);
      void navigate({
        to: REDIRECT_PATHS.STUDIO_EDITOR,
        search: { projectId: undefined, contentId: undefined },
        replace: true,
      });
    },
  });

  useEffect(() => {
    if (!user || isLoadingProject || isOpeningContent) return;
    if (projectIdFromUrl) {
      if (activeProject?.id !== projectIdFromUrl) void fetchAndOpen(projectIdFromUrl);
      return;
    }
    if (activeProject || contentId === undefined) return;
    createFromContent(contentId);
  }, [
    user,
    projectIdFromUrl,
    contentId,
    activeProject,
    isLoadingProject,
    isOpeningContent,
    fetchAndOpen,
    createFromContent,
  ]);

  if (activeProject) {
    return (
      <div className="fixed inset-0 z-50 bg-studio-bg flex flex-col overflow-hidden">
        <EditorLayout
          project={activeProject}
          onBack={() => {
            setActiveProject(null);
            void navigate({
              to: REDIRECT_PATHS.STUDIO_EDITOR,
              search: { projectId: undefined, contentId: undefined },
            });
          }}
        />
      </div>
    );
  }

  if (isLoadingProject || (contentId && isOpeningContent)) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-dim-3 italic">
        {t("common_loading") ?? "Loading…"}
      </div>
    );
  }

  if (isSmallScreen) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-dim-3 text-sm">{t("editor_desktop_only")}</p>
      </div>
    );
  }

  return (
    <EditorProjectList
      onOpen={(project) => {
        setActiveProject(project);
        syncEditorUrl(project);
      }}
    />
  );
}
