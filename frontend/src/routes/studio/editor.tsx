import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { useGenerationHistory } from "@/features/generation/hooks/use-generation";
import { Film, Scissors, Sparkles } from "lucide-react";

function EditorPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const isChildEditorRoute = location.pathname !== "/studio/editor";
  const { data, isLoading } = useGenerationHistory();
  const recentItems = data?.items ?? [];
  const recentDrafts = recentItems.slice(0, 12);

  if (isChildEditorRoute) {
    return <Outlet />;
  }

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="editor" />

        <div className="min-h-0 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-5xl opacity-40">✦</span>
                <p className="text-base font-semibold text-dim-2 mt-3">
                  {t("studio_loading")}
                </p>
              </div>
            </div>
          ) : recentDrafts.length > 0 ? (
            <div className="mx-auto w-full max-w-6xl">
              <div className="rounded-xl border border-overlay-md bg-overlay-xs p-4 md:p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Film className="h-4 w-4 text-studio-accent" />
                  <h1 className="text-base md:text-lg font-semibold tracking-wide">
                    {t("studio_editor_title")}
                  </h1>
                </div>
                <p className="mt-1 text-sm text-dim-1">
                  {t("studio_editor_subtitle")}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recentDrafts.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-overlay-md bg-black/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-primary">
                          {t("studio_editor_card_title", { id: item.id })}
                        </p>
                        <span className="rounded border border-overlay-md px-2 py-0.5 text-sm text-dim-1">
                          {item.outputType}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-dim-1">
                        {item.generatedHook ??
                          item.generatedCaption ??
                          t("studio_editor_card_fallback")}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-sm text-dim-2">
                          <Sparkles className="h-3 w-3" />
                          {t("studio_editor_status", { status: item.status })}
                        </span>
                        <Link
                          to="/studio/editor/$generatedContentId"
                          params={{ generatedContentId: String(item.id) }}
                          className="inline-flex items-center gap-1 rounded-md border border-studio-accent/40 bg-studio-accent/10 px-2.5 py-1 text-sm font-medium text-studio-accent hover:bg-studio-accent/15"
                        >
                          <Scissors className="h-3 w-3" />
                          {t("studio_editor_open_action")}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="rounded-lg border border-overlay-md bg-overlay-xs p-6 text-center">
                <p className="text-base font-semibold text-primary">
                  {t("studio_editor_empty_title")}
                </p>
                <p className="mt-1 text-sm text-dim-1">
                  {t("studio_editor_empty_subtitle")}
                </p>
                <Link
                  to="/studio/generate"
                  className="mt-3 inline-flex rounded-md border border-overlay-lg px-3 py-1.5 text-sm text-dim-1 hover:bg-overlay-sm"
                >
                  {t("studio_editor_go_generate")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/editor")({
  component: EditorPage,
});
