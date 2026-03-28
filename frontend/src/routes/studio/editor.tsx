import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateEditorProjectsQueries } from "@/shared/lib/query-invalidation";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";
import { EditorLayout } from "@/features/editor/components/EditorLayout";
import { uploadProjectThumbnail } from "@/features/editor/services/editor-api";
import type { EditProject } from "@/features/editor/types/editor";

interface ProjectGroup {
  root: EditProject;
  versions: EditProject[];
}

function groupByVersion(projects: EditProject[]): ProjectGroup[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const groups = new Map<string, EditProject[]>();

  for (const p of projects) {
    let rootId = p.id;
    let current = p;
    while (current.parentProjectId && byId.has(current.parentProjectId)) {
      rootId = current.parentProjectId;
      current = byId.get(current.parentProjectId)!;
    }
    const group = groups.get(rootId) ?? [];
    group.push(p);
    groups.set(rootId, group);
  }

  const result: ProjectGroup[] = [];
  for (const [rootId, versions] of groups) {
    versions.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    result.push({ root: byId.get(rootId) ?? versions[0], versions });
  }

  result.sort((a, b) => {
    const latestA = Math.max(
      ...a.versions.map((v) => new Date(v.updatedAt).getTime())
    );
    const latestB = Math.max(
      ...b.versions.map((v) => new Date(v.updatedAt).getTime())
    );
    return latestB - latestA;
  });

  return result;
}

interface ProjectCardProps {
  proj: EditProject;
  vIdx: number;
  groupVersionsLength: number;
  onOpen: () => void;
  onOpenInChat: () => void;
  isLinking: boolean;
  onDelete: () => void;
  onThumbnailChange: (url: string) => void;
  t: (key: string) => string;
}

function ProjectCard({
  proj,
  vIdx,
  groupVersionsLength,
  onOpen,
  onOpenInChat,
  isLinking,
  onDelete,
  onThumbnailChange,
  t,
}: ProjectCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadProjectThumbnail(proj.id, file);
      onThumbnailChange(result.thumbnailUrl);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-xl bg-studio-surface border border-overlay-sm hover:border-overlay-md transition-colors">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-overlay-sm rounded-lg overflow-hidden">
        {proj.thumbnailUrl ? (
          <img
            src={proj.thumbnailUrl}
            alt={proj.generatedHook ?? proj.title ?? "Project thumbnail"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span className="text-2xl opacity-20">✂</span>
          </div>
        )}
        {/* Change thumbnail button — visible on hover */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Change thumbnail"
          className={[
            "absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md",
            "bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100",
            "transition-opacity cursor-pointer border-0 disabled:opacity-40",
          ].join(" ")}
        >
          <ImagePlus size={11} />
          {isUploading ? "Uploading…" : "Change"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <p className="text-sm font-medium text-dim-1 truncate">
            {proj.generatedHook ?? proj.title ?? t("editor_untitled")}
          </p>
          {groupVersionsLength > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-overlay-md text-dim-3 uppercase tracking-wide shrink-0">
              v{vIdx + 1}
            </span>
          )}
          {proj.status === "published" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 uppercase tracking-wide shrink-0">
              {t("editor_status_published")}
            </span>
          )}
        </div>
        <p className="text-xs text-dim-3 mt-0.5">
          {new Date(proj.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {" · "}
          {(proj.durationMs / 1000).toFixed(0)}s
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onOpen}
          className="flex-1 py-1.5 text-xs rounded-lg bg-studio-accent/10 text-studio-accent border border-studio-accent/20 cursor-pointer hover:bg-studio-accent/15 transition-colors"
        >
          {t("editor_open_project")}
        </button>
        <button
          onClick={onOpenInChat}
          disabled={isLinking}
          className="py-1.5 px-2.5 text-xs rounded-lg bg-overlay-sm text-dim-2 border border-overlay-md cursor-pointer hover:bg-overlay-md transition-colors disabled:opacity-50"
        >
          {t("editor_open_in_ai_chat")}
        </button>
        <button
          onClick={onDelete}
          className="py-1.5 px-2.5 text-xs rounded-lg bg-error/10 text-error border border-error/20 cursor-pointer hover:bg-error/15 transition-colors"
        >
          {t("editor_delete_project")}
        </button>
      </div>
    </div>
  );
}

/** URL search uses string query params; coerce so refresh and deep links work. */
function parseEditorSearch(search: Record<string, unknown>) {
  const rawPid = search.projectId;
  const projectParsed =
    typeof rawPid === "string"
      ? z.string().uuid().safeParse(rawPid)
      : { success: false as const };
  const projectId = projectParsed.success ? projectParsed.data : undefined;

  const contentParsed = z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .safeParse(search.contentId);
  const contentId = contentParsed.success ? contentParsed.data : undefined;

  return { projectId, contentId };
}

function EditorPage() {
  const { t } = useTranslation();
  const { user } = useApp();
  const { contentId, projectId: projectIdFromUrl } = Route.useSearch();
  const fetcher = useQueryFetcher<{ projects: EditProject[] }>();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeProject, setActiveProject] = useState<EditProject | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isSmallScreen] = useState(() => window.innerWidth < 1280);

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
      setIsLoadingProject(true);
      try {
        const res = await authenticatedFetchJson<{ project: EditProject }>(
          `/api/editor/${id}`
        );
        setActiveProject(res.project);
        syncEditorUrl(res.project);
      } finally {
        setIsLoadingProject(false);
      }
    },
    [authenticatedFetchJson, syncEditorUrl]
  );

  // Load projects list
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.editorProjects(),
    queryFn: () => fetcher("/api/editor"),
    enabled: !!user,
  });
  const projects = data?.projects ?? [];

  // Create project for a generatedContentId (first time only)
  const { mutate: createFromContent, isPending: isOpeningContent } = useMutation({
    mutationFn: (cId: number) =>
      authenticatedFetchJson<{ project: EditProject }>("/api/editor", {
        method: "POST",
        body: JSON.stringify({ generatedContentId: cId }),
      }),
    onSuccess: (res) => {
      void invalidateEditorProjectsQueries(queryClient);
      setActiveProject(res.project);
      syncEditorUrl(res.project);
    },
    onError: async (err) => {
      // 409: project already exists but wasn't in the local list yet (race on first load).
      const status = (err as { status?: number }).status;
      const body = (err as { body?: { existingProjectId?: string } }).body;
      if (status === 409 && body?.existingProjectId) {
        await invalidateEditorProjectsQueries(queryClient);
        void fetchAndOpen(body.existingProjectId);
      }
    },
  });

  // Open from URL: projectId (refresh-safe) or contentId (deep link from queue / workspace).
  useEffect(() => {
    if (!user) return;
    if (isLoadingProject || isOpeningContent) return;

    if (projectIdFromUrl) {
      if (activeProject?.id === projectIdFromUrl) return;
      void fetchAndOpen(projectIdFromUrl);
      return;
    }

    if (activeProject) return;

    if (contentId === undefined) return;
    if (isLoading) return;

    const existing = projects.find((p) => p.generatedContentId === contentId);
    if (existing) {
      void fetchAndOpen(existing.id);
    } else {
      createFromContent(contentId);
    }
  }, [
    user,
    projectIdFromUrl,
    contentId,
    activeProject,
    isLoadingProject,
    isOpeningContent,
    isLoading,
    projects,
    fetchAndOpen,
    createFromContent,
  ]);

  // Create blank project
  const { mutate: createProject, isPending: isCreating } = useMutation({
    mutationFn: () =>
      authenticatedFetchJson<{ project: EditProject }>("/api/editor", {
        method: "POST",
        body: JSON.stringify({ title: "Untitled Edit" }),
      }),
    onSuccess: (res) => {
      void invalidateEditorProjectsQueries(queryClient);
      setActiveProject(res.project);
      syncEditorUrl(res.project);
    },
  });

  // Delete project
  const { mutate: deleteProject } = useMutation({
    mutationFn: (id: string) =>
      authenticatedFetchJson(`/api/editor/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void invalidateEditorProjectsQueries(queryClient);
    },
  });

  // Open in AI Chat — ensures a generatedContentId exists, then resolves the
  // most recent chat session for that content (creating one if needed).
  const { mutate: openInAIChat, isPending: isLinking } = useMutation({
    mutationFn: async (proj: EditProject) => {
      let contentId = proj.generatedContentId;
      if (!contentId) {
        const res = await authenticatedFetchJson<{ generatedContentId: number }>(
          `/api/editor/${proj.id}/link-content`,
          { method: "POST" },
        );
        contentId = res.generatedContentId;
      }
      return authenticatedFetchJson<{ sessionId: string; projectId: string }>(
        "/api/chat/sessions/resolve-for-content",
        {
          method: "POST",
          body: JSON.stringify({ generatedContentId: contentId }),
        },
      );
    },
    onSuccess: (result) => {
      void navigate({
        to: REDIRECT_PATHS.STUDIO_GENERATE,
        search: { sessionId: result.sessionId, projectId: result.projectId, reelId: undefined },
      });
    },
  });

  const groups = groupByVersion(projects);

  // ── Active editor ─────────────────────────────────────────────────────────
  if (activeProject) {
    return (
      <AuthGuard authType="user">
        <div className="flex flex-col h-screen overflow-hidden">
          <EditorLayout
            project={activeProject}
            onBack={() => {
              setActiveProject(null);
              void navigate({
                to: REDIRECT_PATHS.STUDIO_EDITOR,
                search: {},
              });
            }}
          />
        </div>
      </AuthGuard>
    );
  }

  // Loading state while fetching or creating a project to open
  if (isLoadingProject || (contentId && isOpeningContent)) {
    return (
      <AuthGuard authType="user">
        <div className="grid grid-rows-[48px_1fr] h-screen overflow-hidden">
          <StudioTopBar variant="studio" activeTab="editor" />
          <div className="flex items-center justify-center text-sm text-dim-3 italic">
            {t("common_loading") ?? "Loading…"}
          </div>
        </div>
      </AuthGuard>
    );
  }

  // ── Projects list ─────────────────────────────────────────────────────────
  return (
    <AuthGuard authType="user">
      <div className="grid grid-rows-[48px_1fr] h-screen overflow-hidden">
        <StudioTopBar variant="studio" activeTab="editor" />

        <div className="overflow-y-auto p-6">
          {/* Desktop only guard */}
          {isSmallScreen && (
            <div className="max-w-md mx-auto mt-16 text-center">
              <p className="text-dim-3 text-sm">{t("editor_desktop_only")}</p>
            </div>
          )}

          {!isSmallScreen && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold text-dim-1">
                  {t("studio_tabs_editor")}
                </h1>
                <button
                  onClick={() => createProject()}
                  disabled={isCreating}
                  className={[
                    "flex items-center gap-1.5 bg-gradient-to-br from-studio-accent to-studio-purple",
                    "text-white text-sm font-semibold px-4 py-2 rounded-lg border-0 cursor-pointer",
                    "hover:opacity-90 transition-opacity disabled:opacity-60",
                  ].join(" ")}
                >
                  + {t("editor_new_project")}
                </button>
              </div>

              {isLoading && (
                <div className="text-sm text-dim-3 italic">
                  {t("common_loading") ?? "Loading…"}
                </div>
              )}

              {!isLoading && projects.length === 0 && (
                <div className="flex flex-col items-center gap-4 mt-24">
                  <span className="text-5xl opacity-20">✂</span>
                  <p className="text-sm italic text-dim-3">
                    {t("editor_no_projects")}
                  </p>
                  <button
                    onClick={() => createProject()}
                    disabled={isCreating}
                    className="bg-studio-accent/10 border border-studio-accent/30 text-studio-accent text-sm px-5 py-2 rounded-lg cursor-pointer hover:bg-studio-accent/15 transition-colors"
                  >
                    {t("editor_new_project")}
                  </button>
                </div>
              )}

              {groups.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groups.map((group) =>
                    group.versions.map((proj, vIdx) => (
                      <ProjectCard
                        key={proj.id}
                        proj={proj}
                        vIdx={vIdx}
                        groupVersionsLength={group.versions.length}
                        onOpen={() => void fetchAndOpen(proj.id)}
                        onOpenInChat={() => openInAIChat(proj)}
                        isLinking={isLinking}
                        onDelete={() => {
                          if (
                            confirm(
                              `Delete "${proj.generatedHook ?? proj.title ?? t("editor_untitled")}"?`
                            )
                          )
                            deleteProject(proj.id);
                        }}
                        onThumbnailChange={(url) => {
                          queryClient.setQueryData(
                            queryKeys.api.editorProjects(),
                            (old: { projects: EditProject[] } | undefined) => {
                              if (!old) return old;
                              return {
                                projects: old.projects.map((p) =>
                                  p.id === proj.id ? { ...p, thumbnailUrl: url } : p
                                ),
                              };
                            }
                          );
                        }}
                        t={t}
                      />
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/editor")({
  validateSearch: (search: Record<string, unknown>) =>
    parseEditorSearch(search),
  component: EditorPage,
});
