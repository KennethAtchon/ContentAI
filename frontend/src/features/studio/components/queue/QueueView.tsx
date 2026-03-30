import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/helpers/utils";
import { StudioTopBar } from "@/shared/components/navigation/StudioTopBar";
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
import type { QueueItem } from "@/features/reels/types/reel.types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { StatusFilter, Project, QueueDetail, VersionGroup } from "./queue.types";
import { QueueListItem } from "./QueueListItem";
import { StackedQueueCard } from "./StackedQueueCard";
import { DetailPanel } from "./DetailPanel";

export function QueueView() {
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
  );
}
