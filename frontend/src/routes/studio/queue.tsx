import { useState, useEffect, useRef, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/helpers/utils";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateQueueQueries } from "@/shared/lib/query-invalidation";
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
import type {
  QueueItem,
  PipelineStage,
} from "@/features/reels/types/reel.types";
import {
  Check,
  X,
  Loader2,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { OpenChatButton } from "./_components/OpenChatButton";

/** A group of queue items that belong to the same version chain. */
interface VersionGroup {
  rootContentId: number | null;
  items: QueueItem[];
}

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

interface ContentVersion {
  id: number;
  version: number;
  generatedHook: string | null;
  postCaption: string | null;
  generatedScript: string | null;
  voiceoverScript: string | null;
  sceneDescription: string | null;
  createdAt: string;
}

interface QueueDetail {
  queueItem: QueueItem;
  content: {
    id: number;
    generatedHook: string | null;
    postCaption: string | null;
    generatedScript: string | null;
    voiceoverScript: string | null;
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
  projectId: string | null;
  /** Full version chain, oldest first (v1 … vN). Empty for single-version content. */
  versions: ContentVersion[];
  /** Signed URL from latest completed editor export (preferred final video). */
  latestExportUrl: string | null;
  latestExportStatus: string | null;
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
        item.stages?.some(
          (s) => s.status === "running" || s.status === "pending"
        )
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
    queryKey: queryKeys.api.queueDetail(detailItemId!),
    queryFn: () => detailFetcher(`/api/queue/${detailItemId}/detail`),
    enabled: !!detailItemId,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await authenticatedFetch(`/api/queue/${id}`, { method: "DELETE" });
    },
    onSuccess: (_, id) => {
      if (detailItemId === id) setDetailItemId(null);
      void invalidateQueueQueries(queryClient);
    },
  });

  const duplicateItem = useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/queue/${id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      return res.json() as Promise<{
        queueItem: QueueItem;
        newGeneratedContentId: number;
      }>;
    },
    onSuccess: () => {
      toast.success(t("studio_queue_duplicated"));
      void invalidateQueueQueries(queryClient);
    },
    onError: () => toast.error(t("studio_queue_duplicate_failed")),
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

  // Group items by version chain (rootContentId). Items with the same root
  // are grouped together and displayed as a stacked card with navigation.
  const versionGroups = useMemo(() => {
    const groups: VersionGroup[] = [];
    const seen = new Set<number | null>();

    for (const item of items) {
      const key = item.rootContentId;
      if (key != null && seen.has(key)) continue;
      if (key != null) seen.add(key);

      const siblings =
        key != null
          ? items
              .filter((i) => i.rootContentId === key)
              .sort((a, b) => (a.version ?? 1) - (b.version ?? 1))
          : [item];

      groups.push({ rootContentId: key, items: siblings });
    }
    return groups;
  }, [items]);

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
                        : "bg-transparent text-dim-3 border-overlay-md hover:text-dim-2 hover:border-overlay-lg"
                    )}
                  >
                    {t(`studio_queue_filter_${f}`)}
                  </button>
                ))}
              </div>

              {projects.length > 0 && (
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="h-7 text-sm font-medium border bg-overlay-xs text-dim-2 border-overlay-md focus:outline-none focus:border-studio-accent/30 transition-colors rounded-lg [&>svg]:h-3 [&>svg]:w-3">
                    <SelectValue
                      placeholder={t("studio_queue_filter_all_projects")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("studio_queue_filter_all_projects")}
                    </SelectItem>
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
                  <div
                    key={i}
                    className="studio-skeleton h-[76px] rounded-xl"
                  />
                ))
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center px-4">
                  <span className="text-4xl opacity-25">📅</span>
                  <p className="text-sm font-medium text-dim-3">
                    {t("studio_queue_empty")}
                  </p>
                  <p className="text-sm text-dim-3">
                    {t("studio_queue_emptySub")}
                  </p>
                </div>
              ) : (
                versionGroups.map((group) =>
                  group.items.length > 1 ? (
                    <StackedQueueCard
                      key={`group-${group.rootContentId}`}
                      group={group}
                      selectedItemId={detailItemId}
                      onSelectItem={setDetailItemId}
                      onDelete={(id) => deleteItem.mutate(id)}
                      onDuplicate={(id) => duplicateItem.mutate(id)}
                      deletingId={
                        deleteItem.isPending ? deleteItem.variables : null
                      }
                      duplicatingId={
                        duplicateItem.isPending ? duplicateItem.variables : null
                      }
                    />
                  ) : (
                    <QueueListItem
                      key={group.items[0].id}
                      item={group.items[0]}
                      selected={detailItemId === group.items[0].id}
                      onClick={() => setDetailItemId(group.items[0].id)}
                      onDelete={() => deleteItem.mutate(group.items[0].id)}
                      onDuplicate={() =>
                        duplicateItem.mutate(group.items[0].id)
                      }
                      isDeleting={
                        deleteItem.isPending &&
                        deleteItem.variables === group.items[0].id
                      }
                      isDuplicating={
                        duplicateItem.isPending &&
                        duplicateItem.variables === group.items[0].id
                      }
                    />
                  )
                )
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
                <p className="text-sm text-dim-3">
                  {t("studio_queue_select_prompt")}
                </p>
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
                onDuplicate={() =>
                  duplicateItem.mutate(detailData.queueItem.id)
                }
                isDeleting={
                  deleteItem.isPending &&
                  deleteItem.variables === detailData.queueItem.id
                }
                isDuplicating={
                  duplicateItem.isPending &&
                  duplicateItem.variables === detailData.queueItem.id
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
    ? item.generatedHook.slice(0, 85) +
      (item.generatedHook.length > 85 ? "…" : "")
    : null;

  const failedStages = (item.stages ?? []).filter((s) => s.status === "failed");
  const runningStages = (item.stages ?? []).filter(
    (s) => s.status === "running"
  );

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
          : "bg-transparent border-transparent hover:bg-overlay-xs hover:border-overlay-sm"
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
            STATUS_STYLES[item.status] ?? STATUS_STYLES.draft
          )}
        >
          {item.status}
        </span>
      </div>

      {/* Hook text */}
      <p
        className={cn(
          "text-sm font-medium leading-[1.45] line-clamp-2 pr-20 mb-1.5",
          selected ? "text-primary" : "text-dim-1"
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
                className={cn(
                  "w-[5px] h-[5px] rounded-full flex-shrink-0",
                  STAGE_DOT[stage.status]
                )}
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
            <span className="shrink-0 text-dim-3">
              {t("studio_queue_unscheduled")}
            </span>
          )}
        </div>
      </div>

      {/* Inline alerts */}
      {failedStages.length > 0 && (
        <p className="text-sm text-error mt-1">
          {failedStages.map((s) => s.label).join(", ")}{" "}
          {t("studio_queue_stage_failed")}
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
            confirmDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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

// ─── Version group card (multi-version with left/right nav) ───────────────────

function StackedQueueCard({
  group,
  selectedItemId,
  onSelectItem,
  onDelete,
  onDuplicate,
  deletingId,
  duplicatingId,
}: {
  group: VersionGroup;
  selectedItemId: number | null;
  onSelectItem: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
  deletingId: number | null;
  duplicatingId: number | null;
}) {
  const { t } = useTranslation();
  const sortedItems = group.items;
  const [activeIdx, setActiveIdx] = useState(sortedItems.length - 1);
  const item = sortedItems[activeIdx];
  const isSelected = selectedItemId === item.id;

  const canGoLeft = activeIdx > 0;
  const canGoRight = activeIdx < sortedItems.length - 1;

  const hookPreview = item.generatedHook
    ? item.generatedHook.slice(0, 85) +
      (item.generatedHook.length > 85 ? "…" : "")
    : null;

  const failedStages = (item.stages ?? []).filter((s) => s.status === "failed");
  const runningStages = (item.stages ?? []).filter(
    (s) => s.status === "running"
  );

  return (
    <div
      onClick={() => onSelectItem(item.id)}
      className={cn(
        "group relative rounded-xl px-3 pt-2.5 pb-1.5 cursor-pointer transition-all duration-150 border",
        isSelected
          ? "bg-studio-accent/[0.07] border-studio-accent/25"
          : "bg-transparent border-transparent hover:bg-overlay-xs hover:border-overlay-sm"
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
            STATUS_STYLES[item.status] ?? STATUS_STYLES.draft
          )}
        >
          {item.status}
        </span>
      </div>

      {/* Hook text */}
      <p
        className={cn(
          "text-sm font-medium leading-[1.45] line-clamp-2 pr-20 mb-1.5",
          isSelected ? "text-primary" : "text-dim-1"
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
                className={cn(
                  "w-[5px] h-[5px] rounded-full flex-shrink-0",
                  STAGE_DOT[stage.status]
                )}
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
            <span className="shrink-0 text-dim-3">
              {t("studio_queue_unscheduled")}
            </span>
          )}
        </div>
      </div>

      {/* Inline alerts */}
      {failedStages.length > 0 && (
        <p className="text-sm text-error mt-1">
          {failedStages.map((s) => s.label).join(", ")}{" "}
          {t("studio_queue_stage_failed")}
        </p>
      )}
      {failedStages.length === 0 && runningStages.length > 0 && (
        <p className="text-sm text-warning mt-1">
          {runningStages.map((s) => s.label).join(", ")}…
        </p>
      )}

      {/* Version navigation — inside the card */}
      <div
        className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-overlay-sm/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canGoLeft) setActiveIdx(activeIdx - 1);
          }}
          disabled={!canGoLeft}
          className={cn(
            "p-0.5 rounded transition-colors",
            canGoLeft
              ? "text-dim-2 hover:text-primary hover:bg-overlay-sm cursor-pointer"
              : "text-dim-3/30 cursor-default"
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1.5">
          {sortedItems.map((v, i) => (
            <button
              key={v.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIdx(i);
              }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all cursor-pointer",
                i === activeIdx
                  ? "bg-studio-accent scale-125"
                  : "bg-overlay-lg hover:bg-dim-3"
              )}
              title={`v${v.version ?? i + 1}`}
            />
          ))}
          <span className="text-[10px] font-bold text-dim-3 ml-1 tabular-nums uppercase tracking-wide">
            {t("studio_queue_version_of", {
              version: item.version ?? activeIdx + 1,
              total: sortedItems.length,
            })}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canGoRight) setActiveIdx(activeIdx + 1);
          }}
          disabled={!canGoRight}
          className={cn(
            "p-0.5 rounded transition-colors",
            canGoRight
              ? "text-dim-2 hover:text-primary hover:bg-overlay-sm cursor-pointer"
              : "text-dim-3/30 cursor-default"
          )}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hover actions */}
      {item.status !== "posted" && (
        <div
          className={cn(
            "absolute top-2 right-2 flex items-center gap-1 transition-all duration-150",
            "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(item.id);
            }}
            disabled={duplicatingId === item.id}
            title={t("studio_queue_duplicate")}
            className="p-1.5 rounded-md bg-studio-surface text-studio-fg hover:bg-overlay-lg transition-colors disabled:opacity-50"
          >
            {duplicatingId === item.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            disabled={deletingId === item.id}
            title={t("studio_queue_delete")}
            className="p-1.5 rounded-md bg-studio-surface text-error hover:bg-error/20 transition-colors disabled:opacity-50"
          >
            {deletingId === item.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </button>
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
                STAGE_LINE[stage.status]
              )}
            />
          )}

          {/* Dot + label column */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                STAGE_DOT[stage.status]
              )}
              title={stage.error}
            />
            <span
              className={cn(
                "text-sm font-medium mt-1.5 text-center leading-tight whitespace-nowrap px-1",
                STAGE_LABEL[stage.status]
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
                STAGE_LINE[stages[i + 1]?.status ?? "pending"]
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
  const { sessionId, projectId, queueItem } = detail;
  const assets = detail.assets ?? [];

  // Version navigation — default to the latest (last in array).
  const versions = detail.versions ?? [];
  const hasVersions = versions.length > 1;
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(
    Math.max(0, versions.length - 1)
  );

  // Reset to latest whenever the queue item changes.
  const queueItemId = queueItem.id;
  useEffect(() => {
    setSelectedVersionIdx(Math.max(0, versions.length - 1));
  }, [queueItemId]);

  // Use the selected historical version's copy fields when browsing history,
  // falling back to the live content object for assets/metadata fields.
  const selectedVersion = versions[selectedVersionIdx] ?? null;
  const content = selectedVersion
    ? {
        ...detail.content,
        id: selectedVersion.id,
        version: selectedVersion.version,
        generatedHook: selectedVersion.generatedHook,
        postCaption: selectedVersion.postCaption,
        generatedScript: selectedVersion.generatedScript,
        voiceoverScript: selectedVersion.voiceoverScript,
        sceneDescription: selectedVersion.sceneDescription,
      }
    : detail.content;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const voiceover = assets.find((a) => a.type === "voiceover");
  const music = assets.find((a) => a.type === "music");
  const videoClips = assets.filter((a) => a.type === "video_clip");
  const assembled = assets.find((a) => a.type === "assembled_video");
  const finalVideoUrl =
    detail.latestExportUrl ??
    assembled?.r2Url ??
    content?.videoR2Url ??
    null;

  function handleDelete() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  const voiceoverUrl = voiceover?.r2Url ?? content?.voiceoverUrl ?? null;
  const musicUrl = music?.r2Url ?? content?.backgroundAudioUrl ?? null;
  const hasAudioContent = Boolean(voiceoverUrl ?? musicUrl);
  const hasVideoContent = Boolean(finalVideoUrl);
  const hasCopyContent =
    content?.postCaption ||
    content?.sceneDescription ||
    content?.voiceoverScript ||
    content?.generatedScript;
  const metadata = content?.generatedMetadata as {
    hashtags?: string[];
    cta?: string;
  } | null;
  const hasMetadata = (metadata?.hashtags?.length ?? 0) > 0 || Boolean(metadata?.cta);

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header ── */}
      <div className="px-8 pt-7 pb-6 border-b border-overlay-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm font-bold px-2 py-[3px] rounded-full uppercase tracking-[0.5px]",
                STATUS_STYLES[queueItem.status] ?? STATUS_STYLES.draft
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
          {content?.generatedHook ??
            `${t("studio_queue_itemLabel")} #${queueItem.id}`}
        </h2>

        {/* ── Version navigator ── */}
        {hasVersions && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setSelectedVersionIdx((i) => Math.max(0, i - 1))}
              disabled={selectedVersionIdx === 0}
              className="p-1 rounded-md text-dim-3 hover:text-dim-1 hover:bg-overlay-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-dim-2 tabular-nums select-none">
              v{versions[selectedVersionIdx]?.version ?? 1}
              <span className="text-dim-3">
                {" "}
                / v{versions[versions.length - 1]?.version ?? 1}
              </span>
            </span>
            <button
              onClick={() =>
                setSelectedVersionIdx((i) =>
                  Math.min(versions.length - 1, i + 1)
                )
              }
              disabled={selectedVersionIdx === versions.length - 1}
              className="p-1 rounded-md text-dim-3 hover:text-dim-1 hover:bg-overlay-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {selectedVersionIdx < versions.length - 1 && (
              <span className="text-xs text-dim-3 ml-1">
                (viewing older version)
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-dim-3 flex-wrap">
          {queueItem.scheduledFor ? (
            <span>📅 {new Date(queueItem.scheduledFor).toLocaleString()}</span>
          ) : (
            <span>{t("studio_queue_unscheduled")}</span>
          )}
          {queueItem.instagramPageId && (
            <span>📱 {queueItem.instagramPageId}</span>
          )}
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
              {content?.generatedScript && (
                <CopyField
                  label={t("studio_queue_detail_script")}
                  value={content.generatedScript}
                />
              )}
              {content?.voiceoverScript && (
                <CopyField
                  label={t("studio_queue_detail_clean_script")}
                  value={content.voiceoverScript}
                />
              )}
              {content?.postCaption && (
                <CopyField
                  label={t("studio_queue_detail_caption")}
                  value={content.postCaption}
                />
              )}
              {content?.sceneDescription && (
                <CopyField
                  label={t("studio_queue_detail_scene")}
                  value={content.sceneDescription}
                />
              )}
            </div>
          </div>
        )}

        {/* Hashtags + CTA */}
        {hasMetadata && (
          <div className="space-y-4">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_social")}
            </p>
            <div className="space-y-3">
              {(metadata?.hashtags?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm text-dim-3">{t("studio_queue_detail_hashtags")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata!.hashtags!.map((tag) => (
                      <span
                        key={tag}
                        className="text-sm text-studio-accent/80 bg-studio-accent/10 px-2 py-0.5 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {metadata?.cta && (
                <div className="space-y-1">
                  <p className="text-sm text-dim-3">{t("studio_queue_detail_cta")}</p>
                  <p className="text-sm text-dim-1 italic">"{metadata.cta}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio */}
        {hasAudioContent && (
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_audio")}
            </p>
            <div className="space-y-3">
              <AudioRow
                label={t("studio_queue_detail_voiceover")}
                url={voiceoverUrl}
                noneLabel={t("studio_queue_detail_none")}
              />
              <AudioRow
                label={t("studio_queue_detail_music")}
                url={musicUrl}
                noneLabel={t("studio_queue_detail_none")}
              />
            </div>
          </div>
        )}

        {/* Video */}
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
            {t("studio_queue_detail_video")}
          </p>
          <div className="space-y-3">
            {finalVideoUrl ? (
              <video
                src={finalVideoUrl}
                controls
                className="w-full rounded-lg border border-overlay-md"
                preload="metadata"
              />
            ) : (
              <span className="text-sm text-dim-3">
                {t("studio_queue_detail_no_video")}
              </span>
            )}
            {videoClips.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm text-dim-3">
                  {t("studio_queue_detail_clips", { count: videoClips.length })}
                </p>
                <div className="space-y-1">
                  {videoClips.map((clip, i) => (
                    <div
                      key={clip.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-dim-2">
                        {t("studio_queue_detail_clip_n", { n: i + 1 })}
                      </span>
                      <span className="text-dim-3 tabular-nums">
                        {clip.durationMs != null
                          ? `${(clip.durationMs / 1000).toFixed(1)}s`
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-1">
          <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
            {t("studio_queue_detail_actions")}
          </p>
          <div className="flex flex-wrap gap-2">
            {content?.id != null && (
              <Link
                to="/studio/editor"
                search={{ contentId: content.id }}
                className="inline-flex items-center gap-2 rounded-lg border border-studio-accent/30 bg-studio-accent/10 px-4 py-2 text-sm font-semibold text-studio-accent hover:bg-studio-accent/15 hover:border-studio-accent/50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("editor_open_in_editor")}
              </Link>
            )}
            <OpenChatButton
              sessionId={sessionId}
              projectId={projectId}
              generatedContentId={content?.id ?? null}
              className="inline-flex items-center gap-2 rounded-lg border border-overlay-md bg-overlay-xs px-4 py-2 text-sm font-semibold text-dim-2 hover:text-studio-fg hover:border-overlay-lg transition-colors disabled:opacity-40"
            />
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
      <p className="text-sm text-dim-1 leading-relaxed whitespace-pre-line">
        {value}
      </p>
    </div>
  );
}

function AudioRow({ label, url, noneLabel }: { label: string; url: string | null; noneLabel: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm text-dim-3">{label}</span>
      {url ? (
        <audio src={url} controls className="w-full h-8" preload="metadata" />
      ) : (
        <span className="text-sm text-dim-3 italic">{noneLabel}</span>
      )}
    </div>
  );
}

export const Route = createFileRoute("/studio/queue")({
  component: QueuePage,
});
