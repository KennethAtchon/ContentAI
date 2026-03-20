import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/helpers/utils";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { queryKeys } from "@/shared/lib/query-keys";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useApp } from "@/shared/contexts/app-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { QueueItem, PipelineStage } from "@/features/reels/types/reel.types";
import { Check, X, Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
}

type StatusFilter = "all" | "draft" | "ready" | "scheduled" | "posted" | "failed";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-overlay-sm text-dim-2",
  ready: "bg-violet-400/15 text-violet-400",
  queued: "bg-warning/15 text-warning",
  scheduled: "bg-blue-400/15 text-blue-400",
  posted: "bg-green-400/15 text-green-400",
  failed: "bg-error/15 text-error",
};

const STAGE_DOT: Record<string, string> = {
  ok: "bg-green-400",
  running: "bg-warning animate-pulse",
  failed: "bg-error",
  pending: "bg-overlay-lg",
};

const STAGE_LINE: Record<string, string> = {
  ok: "bg-green-400/35",
  running: "bg-warning/35",
  failed: "bg-error/35",
  pending: "bg-overlay-md",
};

const STAGE_LABEL: Record<string, string> = {
  ok: "text-green-400/70",
  running: "text-warning",
  failed: "text-error",
  pending: "text-dim-3",
};

interface QueueDetail {
  queueItem: QueueItem;
  content: {
    id: number;
    generatedHook: string | null;
    generatedCaption: string | null;
    generatedScript: string | null;
    cleanScriptForAudio: string | null;
    sceneDescription: string | null;
    generatedMetadata: Record<string, unknown> | null;
    voiceoverUrl: string | null;
    backgroundAudioUrl: string | null;
    videoR2Url: string | null;
    status: string;
    version: number;
    outputType: string;
  } | null;
  assets: Array<{
    id: string;
    type: string;
    r2Url: string | null;
    durationMs: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  sessionId: string | null;
}

function QueuePage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailItemId, setDetailItemId] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const { user } = useApp();
  const fetcher = useQueryFetcher<{ items: QueueItem[]; total: number }>();
  const projectsFetcher = useQueryFetcher<{ projects: Project[] }>();
  const detailFetcher = useQueryFetcher<QueueDetail>();
  const { authenticatedFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const queueParams = {
    status: statusFilter === "all" ? undefined : statusFilter,
    projectId: projectFilter === "all" ? undefined : projectFilter,
    search: searchQuery || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.queue(queueParams),
    queryFn: () => {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (projectFilter !== "all") params.set("projectId", projectFilter);
      if (searchQuery) params.set("search", searchQuery);
      return fetcher(`/api/queue?${params}`);
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some((item) =>
        item.stages?.some((s) => s.status === "running" || s.status === "pending"),
      );
      return hasActive ? 6000 : false;
    },
  });

  const { data: projectsData } = useQuery({
    queryKey: queryKeys.api.projects(),
    queryFn: () => projectsFetcher("/api/projects"),
    enabled: !!user,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["api", "queue-detail", detailItemId],
    queryFn: () => detailFetcher(`/api/queue/${detailItemId}/detail`),
    enabled: !!detailItemId,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await authenticatedFetch(`/api/queue/${id}`, { method: "DELETE" });
    },
    onSuccess: (_, id) => {
      if (detailItemId === id) setDetailItemId(null);
      queryClient.invalidateQueries({ queryKey: ["api", "queue"] });
    },
  });

  const duplicateItem = useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/queue/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to duplicate");
      return res.json() as Promise<{ queueItem: QueueItem; newGeneratedContentId: number }>;
    },
    onSuccess: () => {
      toast.success(t("studio_queue_duplicated"));
      queryClient.invalidateQueries({ queryKey: ["api", "queue"] });
    },
    onError: () => toast.error(t("studio_queue_duplicate_failed")),
  });

  const items = data?.items ?? [];
  const projects = projectsData?.projects ?? [];
  const filters: StatusFilter[] = ["all", "draft", "ready", "scheduled", "posted", "failed"];

  // Stages come from the list item (detail API doesn't compute them)
  const selectedItem = items.find((item) => item.id === detailItemId) ?? null;

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="queue" />

        <div className="grid grid-cols-[340px_1fr] overflow-hidden">
          {/* ── Left: list panel ─────────────────────────── */}
          <div className="border-r border-overlay-sm flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="px-4 pt-4 pb-3 shrink-0 space-y-2.5">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-primary tracking-tight">
                  {t("studio_queue_title")}
                </h1>
                {data && (
                  <span className="text-sm font-bold px-1.5 py-[2px] rounded-full bg-studio-accent/15 text-studio-accent tabular-nums">
                    {data.total}
                  </span>
                )}
              </div>

              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("studio_queue_search_placeholder")}
                className="w-full text-sm px-3 py-1.5 rounded-lg border bg-overlay-xs text-dim-1 border-overlay-md placeholder:text-dim-3 focus:outline-none focus:border-studio-accent/30 transition-colors"
              />

              {/* Status filter pills */}
              <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "text-sm font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 cursor-pointer transition-all duration-150 capitalize",
                      statusFilter === f
                        ? "bg-studio-accent/15 text-studio-accent border-studio-accent/30"
                        : "bg-transparent text-dim-3 border-overlay-md hover:text-dim-2 hover:border-overlay-lg",
                    )}
                  >
                    {t(`studio_queue_filter_${f}`)}
                  </button>
                ))}
              </div>

              {projects.length > 0 && (
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="h-7 text-sm font-medium border bg-overlay-xs text-dim-2 border-overlay-md focus:outline-none focus:border-studio-accent/30 transition-colors rounded-lg [&>svg]:h-3 [&>svg]:w-3">
                    <SelectValue placeholder={t("studio_queue_filter_all_projects")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("studio_queue_filter_all_projects")}</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="h-px bg-overlay-sm mx-3 shrink-0" />

            {/* Scrollable item list */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1.5 px-1.5 space-y-0.5">
              {isLoading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="studio-skeleton h-[76px] rounded-xl" />
                ))
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center px-4">
                  <span className="text-4xl opacity-25">📅</span>
                  <p className="text-sm font-medium text-dim-3">
                    {t("studio_queue_empty")}
                  </p>
                  <p className="text-sm text-dim-3">{t("studio_queue_emptySub")}</p>
                </div>
              ) : (
                items.map((item) => (
                  <QueueListItem
                    key={item.id}
                    item={item}
                    selected={detailItemId === item.id}
                    onClick={() => setDetailItemId(item.id)}
                    onDelete={() => deleteItem.mutate(item.id)}
                    onDuplicate={() => duplicateItem.mutate(item.id)}
                    isDeleting={deleteItem.isPending && deleteItem.variables === item.id}
                    isDuplicating={duplicateItem.isPending && duplicateItem.variables === item.id}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right: detail panel ───────────────────────── */}
          <div className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {!detailItemId ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
                <div className="w-10 h-10 rounded-full border border-overlay-md bg-overlay-xs flex items-center justify-center">
                  <span className="text-xl opacity-30">↖</span>
                </div>
                <p className="text-sm text-dim-3">{t("studio_queue_select_prompt")}</p>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-white/20" />
              </div>
            ) : detailData ? (
              <DetailPanel
                detail={detailData}
                stages={selectedItem?.stages ?? []}
                onClose={() => setDetailItemId(null)}
                onDelete={() => deleteItem.mutate(detailData.queueItem.id)}
                onDuplicate={() => duplicateItem.mutate(detailData.queueItem.id)}
                isDeleting={
                  deleteItem.isPending && deleteItem.variables === detailData.queueItem.id
                }
                isDuplicating={
                  duplicateItem.isPending && duplicateItem.variables === detailData.queueItem.id
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

// ─── Queue list item (compact, left panel) ────────────────────────────────────

function QueueListItem({
  item,
  selected,
  onClick,
  onDelete,
  onDuplicate,
  isDeleting,
  isDuplicating,
}: {
  item: QueueItem;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isDeleting: boolean;
  isDuplicating: boolean;
}) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hookPreview = item.generatedHook
    ? item.generatedHook.slice(0, 85) + (item.generatedHook.length > 85 ? "…" : "")
    : null;

  const failedStages = (item.stages ?? []).filter((s) => s.status === "failed");
  const runningStages = (item.stages ?? []).filter((s) => s.status === "running");

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-150 border",
        selected
          ? "bg-studio-accent/[0.07] border-studio-accent/25"
          : "bg-transparent border-transparent hover:bg-overlay-xs hover:border-overlay-sm",
      )}
    >
      {/* Status badge + version — top-right */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
        {item.version != null && item.version > 1 && (
          <span className="text-sm font-bold uppercase tracking-wide text-dim-3">
            v{item.version}
          </span>
        )}
        <span
          className={cn(
            "text-sm font-bold px-1.5 py-[2px] rounded-full uppercase tracking-[0.4px]",
            STATUS_STYLES[item.status] ?? STATUS_STYLES.draft,
          )}
        >
          {item.status}
        </span>
      </div>

      {/* Hook text */}
      <p
        className={cn(
          "text-sm font-medium leading-[1.45] line-clamp-2 pr-20 mb-1.5",
          selected ? "text-primary" : "text-dim-1",
        )}
      >
        {hookPreview ?? `${t("studio_queue_itemLabel")} #${item.id}`}
      </p>

      {/* Pipeline dots + meta row */}
      <div className="flex items-center gap-2">
        {(item.stages ?? []).length > 0 && (
          <div className="flex items-center gap-[5px]">
            {item.stages.map((stage) => (
              <span
                key={stage.id}
                title={`${stage.label}: ${stage.status}`}
                className={cn("w-[5px] h-[5px] rounded-full flex-shrink-0", STAGE_DOT[stage.status])}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sm text-dim-3 ml-auto truncate">
          {item.projectName && (
            <span className="text-violet-400/45 truncate max-w-[80px]">
              ◆ {item.projectName}
            </span>
          )}
          {item.scheduledFor ? (
            <span className="shrink-0">
              {new Date(item.scheduledFor).toLocaleDateString()}
            </span>
          ) : (
            <span className="shrink-0 text-dim-3">{t("studio_queue_unscheduled")}</span>
          )}
        </div>
      </div>

      {/* Inline alerts */}
      {failedStages.length > 0 && (
        <p className="text-sm text-error mt-1">
          {failedStages.map((s) => s.label).join(", ")} {t("studio_queue_stage_failed")}
        </p>
      )}
      {failedStages.length === 0 && runningStages.length > 0 && (
        <p className="text-sm text-warning mt-1">
          {runningStages.map((s) => s.label).join(", ")}…
        </p>
      )}

      {/* Hover actions (bottom-right) */}
      {item.status !== "posted" && (
        <div
          className={cn(
            "absolute bottom-2 right-2 flex items-center gap-1 transition-all duration-150",
            confirmDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {confirmDelete ? (
            <>
              <span className="text-sm text-dim-3 mr-0.5">
                {t("studio_queue_delete_prompt")}
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-md bg-studio-surface text-studio-fg hover:bg-overlay-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 rounded-md bg-error/25 text-error hover:bg-error/35 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                disabled={isDuplicating}
                title={t("studio_queue_duplicate")}
                className="p-1.5 rounded-md bg-studio-surface text-studio-fg hover:bg-overlay-lg transition-colors disabled:opacity-50"
              >
                {isDuplicating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleDelete}
                title={t("studio_queue_delete")}
                className="p-1.5 rounded-md bg-studio-surface text-error hover:bg-error/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline progress track ──────────────────────────────────────────────────

function PipelineTrack({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) return null;
  return (
    <div className="flex items-start">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-start flex-1 min-w-0">
          {/* Connecting line before dot (not on first) */}
          {i > 0 && (
            <div
              className={cn(
                "h-px flex-1 mt-[5px] transition-colors",
                STAGE_LINE[stage.status],
              )}
            />
          )}

          {/* Dot + label column */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                STAGE_DOT[stage.status],
              )}
              title={stage.error}
            />
            <span
              className={cn(
                "text-sm font-medium mt-1.5 text-center leading-tight whitespace-nowrap px-1",
                STAGE_LABEL[stage.status],
              )}
            >
              {stage.label}
            </span>
            {stage.error && (
              <span className="text-sm text-error/65 text-center mt-0.5 leading-tight max-w-[56px] line-clamp-2">
                {stage.error}
              </span>
            )}
          </div>

          {/* Connecting line after dot (not on last) */}
          {i < stages.length - 1 && (
            <div
              className={cn(
                "h-px flex-1 mt-[5px] transition-colors",
                STAGE_LINE[stages[i + 1]?.status ?? "pending"],
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Detail panel (right side, full width) ────────────────────────────────────

function DetailPanel({
  detail,
  stages,
  onClose,
  onDelete,
  onDuplicate,
  isDeleting,
  isDuplicating,
}: {
  detail: QueueDetail;
  stages: PipelineStage[];
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isDeleting: boolean;
  isDuplicating: boolean;
}) {
  const { t } = useTranslation();
  const { content, assets, sessionId, queueItem } = detail;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const voiceover = assets.find((a) => a.type === "voiceover");
  const music = assets.find((a) => a.type === "music");
  const videoClips = assets.filter((a) => a.type === "video_clip");
  const assembled = assets.find((a) => a.type === "assembled_video");

  function handleDelete() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  const hasAudioContent =
    voiceover?.r2Url ||
    music?.r2Url ||
    content?.voiceoverUrl ||
    content?.backgroundAudioUrl;
  const hasVideoContent = assembled?.r2Url || content?.videoR2Url;
  const hasCopyContent =
    content?.generatedCaption ||
    content?.sceneDescription ||
    content?.cleanScriptForAudio;

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header ── */}
      <div className="px-8 pt-7 pb-6 border-b border-overlay-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm font-bold px-2 py-[3px] rounded-full uppercase tracking-[0.5px]",
                STATUS_STYLES[queueItem.status] ?? STATUS_STYLES.draft,
              )}
            >
              {queueItem.status}
            </span>
            {content?.version != null && content.version > 1 && (
              <span className="text-sm font-bold px-1.5 py-[2px] rounded-full bg-overlay-md text-dim-2 uppercase tracking-wide">
                v{content.version}
              </span>
            )}
            {content?.outputType && (
              <span className="text-sm font-medium text-dim-3 uppercase tracking-wide">
                {content.outputType}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-dim-3 hover:text-dim-1 transition-colors shrink-0 p-1 -mr-1 -mt-1 rounded-md hover:bg-overlay-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="text-lg font-semibold text-primary leading-[1.5] mb-4">
          {content?.generatedHook ?? `${t("studio_queue_itemLabel")} #${queueItem.id}`}
        </h2>

        <div className="flex items-center gap-4 text-sm text-dim-3 flex-wrap">
          {queueItem.scheduledFor ? (
            <span>📅 {new Date(queueItem.scheduledFor).toLocaleString()}</span>
          ) : (
            <span>{t("studio_queue_unscheduled")}</span>
          )}
          {queueItem.instagramPageId && <span>📱 {queueItem.instagramPageId}</span>}
          {queueItem.errorMessage && (
            <span className="text-error">⚠ {queueItem.errorMessage}</span>
          )}
        </div>
      </div>

      {/* ── Pipeline track ── */}
      {stages.length > 0 && (
        <div className="px-8 py-5 border-b border-overlay-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-dim-3 mb-4">
            {t("studio_queue_pipeline_label")}
          </p>
          <PipelineTrack stages={stages} />
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 px-8 py-6 space-y-7">
        {/* Copy section */}
        {hasCopyContent && (
          <div className="space-y-4">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_copy")}
            </p>
            <div className="space-y-4">
              {content?.generatedCaption && (
                <CopyField
                  label={t("studio_queue_detail_caption")}
                  value={content.generatedCaption}
                />
              )}
              {content?.sceneDescription && (
                <CopyField
                  label={t("studio_queue_detail_scene")}
                  value={content.sceneDescription}
                />
              )}
              {content?.cleanScriptForAudio && (
                <CopyField
                  label={t("studio_queue_detail_clean_script")}
                  value={content.cleanScriptForAudio}
                />
              )}
            </div>
          </div>
        )}

        {/* Audio + Video in 2-col grid when both present, else single column */}
        <div
          className={cn(
            "grid gap-6",
            hasAudioContent && hasVideoContent ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {/* Audio */}
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_audio")}
            </p>
            <div className="space-y-2.5">
              <AssetRow
                label={t("studio_queue_detail_voiceover")}
                url={voiceover?.r2Url ?? content?.voiceoverUrl ?? null}
                listenLabel={t("studio_queue_detail_listen")}
                noneLabel={t("studio_queue_detail_none")}
              />
              <AssetRow
                label={t("studio_queue_detail_music")}
                url={music?.r2Url ?? content?.backgroundAudioUrl ?? null}
                listenLabel={t("studio_queue_detail_listen")}
                noneLabel={t("studio_queue_detail_none")}
              />
            </div>
          </div>

          {/* Video */}
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_video")}
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-dim-2">
                  {t("studio_queue_detail_clips", { count: videoClips.length })}
                </span>
              </div>
              {assembled?.r2Url || content?.videoR2Url ? (
                <a
                  href={(assembled?.r2Url ?? content?.videoR2Url)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-studio-accent hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("studio_queue_detail_view_assembled")}
                </a>
              ) : (
                <span className="text-sm text-dim-3">
                  {t("studio_queue_detail_no_video")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-1">
          <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
            {t("studio_queue_detail_actions")}
          </p>
          <div className="flex flex-wrap gap-2">
            {sessionId && (
              <Link
                to="/studio/generate"
                search={{ session: sessionId } as Record<string, string>}
                className="inline-flex items-center gap-2 rounded-lg border border-overlay-md bg-overlay-xs px-4 py-2 text-sm font-semibold text-dim-2 hover:text-studio-fg hover:border-overlay-lg transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("studio_queue_detail_open_chat")}
              </Link>
            )}
            {queueItem.status !== "posted" && (
              <button
                onClick={onDuplicate}
                disabled={isDuplicating}
                className="inline-flex items-center gap-2 rounded-lg border border-overlay-md bg-overlay-xs px-4 py-2 text-sm font-semibold text-dim-2 hover:text-dim-1 hover:border-overlay-lg transition-colors disabled:opacity-40"
              >
                {isDuplicating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {t("studio_queue_duplicate")}
              </button>
            )}
          </div>

          {/* Delete */}
          {queueItem.status !== "posted" && (
            <div className="flex items-center gap-2 pt-1">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-dim-3">
                    {t("studio_queue_delete_prompt")}
                  </span>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-overlay-md bg-overlay-xs px-3 py-1.5 text-sm font-medium text-dim-2 hover:text-dim-1 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    {t("studio_queue_delete_cancel")}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-error/30 bg-error/10 px-3 py-1.5 text-sm font-semibold text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {t("studio_queue_delete_confirm")}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDelete}
                  className="text-sm font-medium text-error/50 hover:text-error transition-colors"
                >
                  {t("studio_queue_delete")}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Small field components ───────────────────────────────────────────────────

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-dim-3">{label}</p>
      <p className="text-sm text-dim-1 leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}

function AssetRow({
  label,
  url,
  listenLabel,
  noneLabel,
}: {
  label: string;
  url: string | null;
  listenLabel: string;
  noneLabel: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-dim-2">{label}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-studio-accent hover:underline"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          {listenLabel}
        </a>
      ) : (
        <span className="text-sm text-dim-3">{noneLabel}</span>
      )}
    </div>
  );
}

export const Route = createFileRoute("/studio/queue")({
  component: QueuePage,
});
