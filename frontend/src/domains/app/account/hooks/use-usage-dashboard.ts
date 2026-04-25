import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { invalidateUsageStatsAndGenerationHistory } from "@/app/query/query-invalidation";
import { useApp } from "@/app/state/app-context";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import {
  buildGenerationHistoryUrl,
  exportUsageCsv,
  type GenerationHistoryResponse,
  type UsageStats,
  HISTORY_PAGE_LIMIT,
} from "../api/account-usage.service";

function isUnlimited(limit: number | null | undefined): boolean {
  return limit === null || limit === -1;
}

export function formatGenerationTime(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function getContentShortName(type: string): string {
  return type;
}

export function useUsageDashboard() {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const usageFetcher = useQueryFetcher<UsageStats>();
  const historyFetcher = useQueryFetcher<GenerationHistoryResponse>();
  const [historyPage, setHistoryPage] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);

  const historyUrl = useMemo(
    () => buildGenerationHistoryUrl(historyPage),
    [historyPage]
  );

  const {
    data: usageStats,
    error: statsError,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: queryKeys.api.usageStats(),
    queryFn: () => usageFetcher("/api/customer/usage"),
    enabled: !!user,
  });

  const {
    data: historyResponse,
    error: historyError,
    isLoading: historyLoading,
  } = useQuery({
    queryKey: queryKeys.api.generationHistory({
      page: historyPage,
      limit: HISTORY_PAGE_LIMIT,
    } as never),
    queryFn: () => historyFetcher(historyUrl),
    enabled: !!user,
  });

  const handleExportUsage = async () => {
    if (!user) {
      return;
    }

    try {
      setExportError(null);
      const response = await exportUsageCsv();
      if (response.url) {
        window.open(response.url, "_blank");
      }
      void invalidateUsageStatsAndGenerationHistory(queryClient);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export usage data"
      );
    }
  };

  const history = historyResponse?.data ?? [];
  const historyPagination = historyResponse?.pagination;
  const loading = statsLoading || historyLoading;
  const error = statsError || historyError;
  const reelsPercentage =
    !isUnlimited(usageStats?.reelsAnalyzedLimit) &&
    usageStats?.reelsAnalyzedLimit
      ? Math.round(
          (usageStats.reelsAnalyzed / usageStats.reelsAnalyzedLimit) * 100
        )
      : 0;
  const generationPercentage =
    !isUnlimited(usageStats?.contentGeneratedLimit) &&
    usageStats?.contentGeneratedLimit
      ? Math.round(
          (usageStats.contentGenerated / usageStats.contentGeneratedLimit) * 100
        )
      : 0;

  return {
    error,
    exportError,
    generationPercentage,
    getContentTypeLabel: getContentShortName,
    handleExportUsage,
    handleHistoryPageChange: setHistoryPage,
    history,
    historyPage,
    historyPagination,
    isUnlimited,
    loading,
    reelsPercentage,
    usageStats,
    user,
  };
}
