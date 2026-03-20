import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import { EditorLayout } from "@/features/editor/components/EditorLayout";
import type { EditProject } from "@/features/editor/types/editor";

function EditorPage() {
  const { t } = useTranslation();
  const { user } = useApp();
  const fetcher = useQueryFetcher<{ projects: EditProject[] }>();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const [activeProject, setActiveProject] = useState<EditProject | null>(null);
  const [isSmallScreen] = useState(() => window.innerWidth < 1280);

  // Load projects list
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.editorProjects(),
    queryFn: () => fetcher("/api/editor"),
    enabled: !!user,
  });
  const projects = data?.projects ?? [];

  // Create project
  const { mutate: createProject, isPending: isCreating } = useMutation({
    mutationFn: () =>
      authenticatedFetchJson<{ project: EditProject }>("/api/editor", {
        method: "POST",
        body: JSON.stringify({ title: "Untitled Edit" }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.editorProjects(),
      });
      setActiveProject(res.project);
    },
  });

  // Delete project
  const { mutate: deleteProject } = useMutation({
    mutationFn: (id: string) =>
      authenticatedFetchJson(`/api/editor/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.editorProjects(),
      });
    },
  });

  // ── Active editor ─────────────────────────────────────────────────────────
  if (activeProject) {
    return (
      <AuthGuard authType="user">
        <div className="flex flex-col h-screen overflow-hidden">
          {/* Hide StudioTopBar when editor is open — editor has its own toolbar */}
          <EditorLayout
            project={activeProject}
            onBack={() => setActiveProject(null)}
          />
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

              {projects.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="group relative flex flex-col gap-3 p-4 rounded-xl bg-studio-surface border border-overlay-sm hover:border-overlay-md transition-colors"
                    >
                      {/* Thumbnail placeholder */}
                      <div className="aspect-video bg-overlay-sm rounded-lg flex items-center justify-center">
                        <span className="text-2xl opacity-20">✂</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dim-1 truncate">
                          {proj.title}
                        </p>
                        <p className="text-xs text-dim-3 mt-0.5">
                          {new Date(proj.updatedAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                          {" · "}
                          {(proj.durationMs / 1000).toFixed(0)}s
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveProject(proj)}
                          className="flex-1 py-1.5 text-xs rounded-lg bg-studio-accent/10 text-studio-accent border border-studio-accent/20 cursor-pointer hover:bg-studio-accent/15 transition-colors"
                        >
                          {t("editor_open_project")}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${proj.title}"?`))
                              deleteProject(proj.id);
                          }}
                          className="py-1.5 px-2.5 text-xs rounded-lg bg-error/10 text-error border border-error/20 cursor-pointer hover:bg-error/15 transition-colors"
                        >
                          {t("editor_delete_project")}
                        </button>
                      </div>
                    </div>
                  ))}
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
  component: EditorPage,
});
