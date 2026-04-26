import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { invalidateQueueQueries } from "@/app/query/query-invalidation";
import { queryKeys } from "@/app/query/query-keys";
import { useAuth } from "@/app/state/auth-context";
import { useAuthenticatedFetch } from "@/domains/auth/hooks/use-authenticated-fetch";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { useResolvedParam } from "@/shared/react/use-resolved-param";
import type { QueueItem } from "@/domains/reels/model/reel.types";
import {
  buildQueueDetailUrl,
  buildQueueListUrl,
  groupQueueItemsByVersion,
  type QueueDetail,
  type QueueListResponse,
  type QueueProjectsResponse,
} from "../api/queue.service";
import type { Project, StatusFilter } from "../ui/queue/queue.types";

const FILTERS: StatusFilter[] = [
  "all",
  "draft",
  "ready",
  "scheduled",
  "posted",
  "failed",
];

export function useQueueView() {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as { projectId?: string };
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>(
    search.projectId ?? "all"
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queueFetcher = useQueryFetcher<QueueListResponse>();
  const projectsFetcher = useQueryFetcher<QueueProjectsResponse>();
  const detailFetcher = useQueryFetcher<QueueDetail>();
  const { authenticatedFetch } = useAuthenticatedFetch();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchInput]);

  const queueParams = {
    status: statusFilter === "all" ? undefined : statusFilter,
    projectId: projectFilter === "all" ? undefined : projectFilter,
    search: searchQuery || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.queue(queueParams),
    queryFn: () =>
      queueFetcher(
        buildQueueListUrl({ projectFilter, searchQuery, statusFilter })
      ),
    enabled: !!user,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some((item) =>
        item.stages?.some(
          (stage) => stage.status === "running" || stage.status === "pending"
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
    queryFn: () => detailFetcher(buildQueueDetailUrl(detailItemId!)),
    enabled: !!detailItemId,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await authenticatedFetch(`/api/queue/${id}`, { method: "DELETE" });
    },
    onSuccess: (_, id) => {
      if (detailItemId === id) {
        setDetailItemId(null);
      }
      void invalidateQueueQueries(queryClient);
    },
  });

  const duplicateItem = useMutation({
    mutationFn: async (id: number) => {
      const response = await authenticatedFetch(`/api/queue/${id}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to duplicate");
      }
      return response.json() as Promise<{
        queueItem: QueueItem;
        newGeneratedContentId: number;
      }>;
    },
    onSuccess: () => {
      toast.success(t("studio_queue_duplicated"));
      void invalidateQueueQueries(queryClient);
    },
    onError: () => {
      toast.error(t("studio_queue_duplicate_failed"));
    },
  });

  const items = data?.items ?? [];
  const projects: Project[] = projectsData?.projects ?? [];
  const selectedProjectExists =
    projectFilter === "all" ||
    projects.some((project) => project.id === projectFilter);

  const clearMissingProjectFilter = useCallback(() => {
    setProjectFilter("all");
    void navigate({
      to: "/studio/queue",
      search: { projectId: undefined },
      replace: true,
    });
  }, [navigate]);

  useResolvedParam({
    paramValue: projectFilter === "all" ? null : projectFilter,
    isMissing:
      projectFilter !== "all" && projects.length > 0 && !selectedProjectExists,
    notFoundMessage: "Project not found",
    onMissing: clearMissingProjectFilter,
  });

  const versionGroups = useMemo(() => groupQueueItemsByVersion(items), [items]);
  const selectedItem = items.find((item) => item.id === detailItemId) ?? null;

  return {
    data,
    deleteItem,
    detailData,
    detailItemId,
    detailLoading,
    duplicateItem,
    filters: FILTERS,
    isLoading,
    items,
    projectFilter,
    projects,
    searchInput,
    selectedItem,
    selectedProjectExists,
    setDetailItemId,
    setProjectFilter,
    setSearchInput,
    setStatusFilter,
    statusFilter,
    versionGroups,
  };
}
