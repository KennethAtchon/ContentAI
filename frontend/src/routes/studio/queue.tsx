import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/helpers/utils";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import type { QueueItem } from "@/features/reels/types/reel.types";

interface Project {
  id: string;
  name: string;
}

type StatusFilter =
  | "all"
  | "draft"
  | "ready"
  | "scheduled"
  | "posted"
  | "failed";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/[0.06] text-slate-200/40",
  ready: "bg-violet-400/15 text-violet-400",
  queued: "bg-amber-400/15 text-amber-400",
  scheduled: "bg-blue-400/15 text-blue-400",
  posted: "bg-green-400/15 text-green-400",
  failed: "bg-red-400/15 text-red-400",
};

function QueuePage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const { user } = useApp();
  const fetcher = useQueryFetcher<{ items: QueueItem[]; total: number }>();
  const projectsFetcher = useQueryFetcher<{ projects: Project[] }>();
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const queueParams = {
    status: statusFilter === "all" ? undefined : statusFilter,
    projectId: projectFilter === "all" ? undefined : projectFilter,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.queue(queueParams),
    queryFn: () => {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (projectFilter !== "all") params.set("projectId", projectFilter);
      return fetcher(`/api/queue?${params}`);
    },
    enabled: !!user,
  });

  const { data: projectsData } = useQuery({
    queryKey: queryKeys.api.projects(),
    queryFn: () => projectsFetcher("/api/projects"),
    enabled: !!user,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await authenticatedFetch(`/api/queue/${id}`, { method: "DELETE" });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["api", "queue"] }),
  });

  const items = data?.items ?? [];
  const projects = projectsData?.projects ?? [];
  const filters: StatusFilter[] = [
    "all",
    "draft",
    "ready",
    "scheduled",
    "posted",
    "failed",
  ];

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="queue" />

        <div className="overflow-y-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="max-w-[860px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <h1 className="text-[18px] font-bold text-slate-100">
                {t("studio_queue_title")}
              </h1>
              {data && (
                <span className="bg-studio-accent/15 text-studio-accent text-[10px] font-bold px-2 py-px rounded-full">
                  {data.total}
                </span>
              )}
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              {/* Status filter pills */}
              <div className="flex gap-1.5 flex-wrap">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "text-[11px] font-medium px-3 py-1.5 rounded-full border cursor-pointer font-studio transition-all duration-150",
                      statusFilter === f
                        ? "bg-studio-accent/15 text-studio-accent border-studio-accent/30"
                        : "bg-white/[0.03] text-slate-200/40 border-white/[0.08] hover:text-slate-200/70"
                    )}
                  >
                    {t(`studio_queue_filter_${f}`)}
                  </button>
                ))}
              </div>

              {/* Project filter */}
              {projects.length > 0 && (
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-full border bg-white/[0.03] text-slate-200/60 border-white/[0.08] cursor-pointer font-studio appearance-none focus:outline-none focus:border-studio-accent/30 transition-colors"
                >
                  <option value="all">
                    {t("studio_queue_filter_all_projects")}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="studio-skeleton h-[104px] rounded-[14px]"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <span className="text-[48px] opacity-40">📅</span>
                <p className="text-[15px] font-semibold text-slate-200/50">
                  {t("studio_queue_empty")}
                </p>
                <p className="text-[12px] text-slate-200/25">
                  {t("studio_queue_emptySub")}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    onDelete={() => deleteItem.mutate(item.id)}
                    isDeleting={deleteItem.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function QueueCard({
  item,
  onDelete,
  isDeleting,
}: {
  item: QueueItem;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formattedDate = item.scheduledFor
    ? new Date(item.scheduledFor).toLocaleString()
    : t("studio_queue_unscheduled");

  const hookPreview = item.generatedHook
    ? item.generatedHook.slice(0, 120) +
      (item.generatedHook.length > 120 ? "…" : "")
    : null;

  const editHref =
    item.projectId && item.sessionId
      ? `/studio/generate?project=${item.projectId}&session=${item.sessionId}`
      : null;

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-[14px] p-4 transition-colors hover:border-white/10">
      {/* Top row: hook preview + status badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[13px] font-semibold text-studio-fg leading-[1.4] flex-1">
          {hookPreview ?? `${t("studio_queue_itemLabel")} #${item.id}`}
        </p>
        <span
          className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-[0.5px] shrink-0",
            STATUS_STYLES[item.status] ?? STATUS_STYLES.draft
          )}
        >
          {item.status}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-slate-200/30 flex-wrap mb-3">
        <span>📅 {formattedDate}</span>
        {item.projectName && (
          <span className="text-violet-400/60">◆ {item.projectName}</span>
        )}
        {!item.projectName && <span>{t("studio_queue_no_project")}</span>}
        {item.instagramPageId && <span>📱 {item.instagramPageId}</span>}
        {item.errorMessage && (
          <span className="text-red-400">⚠ {item.errorMessage}</span>
        )}
      </div>

      {/* Actions */}
      {item.status !== "posted" && (
        <div className="flex items-center gap-2">
          {editHref && (
            <a
              href={editHref}
              className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-slate-200/60 font-studio transition-all hover:text-slate-200/90 hover:border-white/20"
            >
              {t("studio_queue_edit")}
            </a>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-slate-200/40">
                {t("studio_queue_delete_prompt")}
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-slate-200/40 cursor-pointer font-studio transition-all hover:text-slate-200/70"
              >
                {t("studio_queue_delete_cancel")}
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-red-400/30 bg-red-400/10 text-red-400 cursor-pointer font-studio transition-all hover:bg-red-400/20 disabled:opacity-50"
              >
                {t("studio_queue_delete_confirm")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-red-400/20 bg-red-400/[0.05] text-red-400 cursor-pointer font-studio transition-all hover:bg-red-400/10 ml-auto"
            >
              {t("studio_queue_delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/studio/queue")({
  component: QueuePage,
});
